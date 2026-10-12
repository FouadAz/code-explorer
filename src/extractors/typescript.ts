import * as Parser from 'web-tree-sitter';
import { BaseExtractor } from './base';
import {
  FileAnalysis,
  GraphNode,
  ImportInfo,
  ExportInfo,
  RawReference,
  Language,
  MethodInfo,
  PropertyInfo,
  ParameterInfo,
} from '../types';
import { AstCache } from '../parser/astCache';

/**
 * TypeScript/JavaScript extractor using Tree-sitter.
 */
export class TypeScriptExtractor extends BaseExtractor {
  extract(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): FileAnalysis {
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const nodes: GraphNode[] = [];
    const rawReferences: RawReference[] = [];
    const errors: string[] = [];

    const rootNode = tree.rootNode;

    // Extract imports
    this.extractImports(rootNode, sourceCode, imports);

    // Extract exports
    this.extractExports(rootNode, sourceCode, exports);

    // Extract classes, interfaces, functions
    this.extractTopLevelNodes(rootNode, sourceCode, filePath, language, nodes, rawReferences);

    // Count lines
    const linesOfCode = sourceCode.split('\n').filter(line => line.trim().length > 0).length;

    return {
      filePath,
      language,
      imports,
      exports,
      nodes,
      rawReferences,
      errors,
      linesOfCode,
      hash: AstCache.hashContent(sourceCode),
    };
  }

  private extractImports(node: Parser.SyntaxNode, sourceCode: string, imports: ImportInfo[]): void {
    if (node.type === 'import_statement') {
      const importInfo = this.parseImportStatement(node, sourceCode);
      if (importInfo) imports.push(importInfo);
    }

    for (const child of node.children) {
      this.extractImports(child, sourceCode, imports);
    }
  }

  private parseImportStatement(node: Parser.SyntaxNode, sourceCode: string): ImportInfo | null {
    const sourceNode = this.findChild(node, 'string');
    if (!sourceNode) return null;

    const source = this.getText(sourceNode, sourceCode).replace(/['"]/g, '');
    const specifiers: { name: string; alias?: string }[] = [];
    let isDefault = false;
    let isNamespace = false;
    let isSideEffect = false;

    const importClause = this.findChild(node, 'import_clause');
    if (!importClause) {
      // Side-effect import: import './styles.css'
      isSideEffect = true;
    } else {
      // Named imports
      const namedImports = this.findChild(importClause, 'named_imports');
      if (namedImports) {
        for (const spec of namedImports.children) {
          if (spec.type === 'import_specifier') {
            const name = this.getText(spec.childForFieldName('name') || spec, sourceCode);
            const alias = spec.childForFieldName('alias');
            specifiers.push({
              name,
              alias: alias ? this.getText(alias, sourceCode) : undefined,
            });
          }
        }
      }

      // Default import
      const identifier = this.findChild(importClause, 'identifier');
      if (identifier) {
        isDefault = true;
        specifiers.push({ name: this.getText(identifier, sourceCode) });
      }

      // Namespace import: import * as X
      const namespaceImport = this.findChild(importClause, 'namespace_import');
      if (namespaceImport) {
        isNamespace = true;
        const alias = this.findChild(namespaceImport, 'identifier');
        if (alias) {
          specifiers.push({ name: '*', alias: this.getText(alias, sourceCode) });
        }
      }
    }

    return {
      source,
      specifiers,
      isDefault,
      isNamespace,
      isSideEffect,
      line: this.getLine(node),
    };
  }

  private extractExports(node: Parser.SyntaxNode, sourceCode: string, exports: ExportInfo[]): void {
    if (node.type === 'export_statement') {
      const declaration = node.childForFieldName('declaration');
      if (declaration) {
        const name = this.getDeclarationName(declaration, sourceCode);
        if (name) {
          exports.push({
            name,
            isDefault: false,
            kind: this.getNodeKind(declaration.type),
            line: this.getLine(node),
          });
        }
      }
    }

    if (node.type === 'export_statement' && this.getText(node, sourceCode).includes('export default')) {
      exports.push({
        name: 'default',
        isDefault: true,
        kind: 'function',
        line: this.getLine(node),
      });
    }

    for (const child of node.children) {
      this.extractExports(child, sourceCode, exports);
    }
  }

  private extractTopLevelNodes(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
    nodes: GraphNode[],
    rawReferences: RawReference[],
  ): void {
    for (const child of node.children) {
      switch (child.type) {
        case 'class_declaration':
          nodes.push(this.extractClass(child, sourceCode, filePath, language, rawReferences));
          break;
        case 'interface_declaration':
          nodes.push(this.extractInterface(child, sourceCode, filePath, language));
          break;
        case 'type_alias_declaration':
          nodes.push(this.extractTypeAlias(child, sourceCode, filePath, language));
          break;
        case 'function_declaration':
          nodes.push(this.extractFunction(child, sourceCode, filePath, language));
          break;
        case 'enum_declaration':
          nodes.push(this.extractEnum(child, sourceCode, filePath, language));
          break;
      }
    }
  }

  private extractClass(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
    rawReferences: RawReference[],
  ): GraphNode {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'AnonymousClass';
    const decorators = this.extractDecorators(node, sourceCode);

    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];

    const body = node.childForFieldName('body');
    if (body) {
      for (const member of body.children) {
        if (member.type === 'method_definition') {
          methods.push(this.extractMethod(member, sourceCode));
        } else if (member.type === 'public_field_definition' || member.type === 'field_definition') {
          properties.push(this.extractProperty(member, sourceCode));
        }
      }
    }

    // Extract inheritance
    const heritage = node.childForFieldName('heritage');
    if (heritage) {
      for (const clause of heritage.children) {
        if (clause.type === 'extends_clause') {
          const typeNode = this.findChild(clause, 'identifier');
          if (typeNode) {
            rawReferences.push({
              name: this.getText(typeNode, sourceCode),
              kind: 'inherits',
              line: this.getLine(clause),
              confidence: 'definite',
              evidence: 'extends clause in class declaration',
            });
          }
        }
        if (clause.type === 'implements_clause') {
          for (const impl of clause.children) {
            if (impl.type === 'type_identifier') {
              rawReferences.push({
                name: this.getText(impl, sourceCode),
                kind: 'implements',
                line: this.getLine(impl),
                confidence: 'definite',
                evidence: 'implements clause in class declaration',
              });
            }
          }
        }
      }
    }

    return {
      id: this.generateNodeId(filePath, name, this.getLine(node)),
      name,
      kind: 'class',
      language,
      filePath,
      lineStart: this.getLine(node),
      lineEnd: node.endPosition.row + 1,
      archRole: this.determineArchRole(name, decorators),
      methods,
      properties,
      decorators,
      linesOfCode: node.endPosition.row - node.startPosition.row + 1,
    };
  }

  private extractInterface(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): GraphNode {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'AnonymousInterface';

    return {
      id: this.generateNodeId(filePath, name, this.getLine(node)),
      name,
      kind: 'interface',
      language,
      filePath,
      lineStart: this.getLine(node),
      lineEnd: node.endPosition.row + 1,
      archRole: 'unknown',
      methods: [],
      properties: [],
      decorators: [],
      linesOfCode: node.endPosition.row - node.startPosition.row + 1,
    };
  }

  private extractTypeAlias(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): GraphNode {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'AnonymousType';

    return {
      id: this.generateNodeId(filePath, name, this.getLine(node)),
      name,
      kind: 'type_alias',
      language,
      filePath,
      lineStart: this.getLine(node),
      lineEnd: node.endPosition.row + 1,
      archRole: 'unknown',
      methods: [],
      properties: [],
      decorators: [],
      linesOfCode: node.endPosition.row - node.startPosition.row + 1,
    };
  }

  private extractFunction(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): GraphNode {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'anonymousFunction';

    const method = this.extractMethod(node, sourceCode);

    return {
      id: this.generateNodeId(filePath, name, this.getLine(node)),
      name,
      kind: 'function',
      language,
      filePath,
      lineStart: this.getLine(node),
      lineEnd: node.endPosition.row + 1,
      archRole: this.determineArchRole(name, []),
      methods: [method],
      properties: [],
      decorators: [],
      linesOfCode: node.endPosition.row - node.startPosition.row + 1,
    };
  }

  private extractEnum(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): GraphNode {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'AnonymousEnum';

    return {
      id: this.generateNodeId(filePath, name, this.getLine(node)),
      name,
      kind: 'enum',
      language,
      filePath,
      lineStart: this.getLine(node),
      lineEnd: node.endPosition.row + 1,
      archRole: 'unknown',
      methods: [],
      properties: [],
      decorators: [],
      linesOfCode: node.endPosition.row - node.startPosition.row + 1,
    };
  }

  private extractMethod(node: Parser.SyntaxNode, sourceCode: string): MethodInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'anonymous';

    const parameters: ParameterInfo[] = [];
    const params = node.childForFieldName('parameters');
    if (params) {
      for (const param of params.children) {
        if (param.type === 'required_parameter' || param.type === 'optional_parameter') {
          const paramName = param.childForFieldName('pattern');
          const paramType = param.childForFieldName('type');
          parameters.push({
            name: paramName ? this.getText(paramName, sourceCode) : 'arg',
            type: paramType ? this.getText(paramType, sourceCode) : undefined,
            isOptional: param.type === 'optional_parameter',
            defaultValue: undefined,
          });
        }
      }
    }

    const returnTypeNode = node.childForFieldName('return_type');
    const decorators = this.extractDecorators(node, sourceCode);

    return {
      name,
      parameters,
      returnType: returnTypeNode ? this.getText(returnTypeNode, sourceCode) : undefined,
      visibility: 'public',
      isStatic: this.getText(node, sourceCode).includes('static'),
      isAsync: this.getText(node, sourceCode).includes('async'),
      isAbstract: this.getText(node, sourceCode).includes('abstract'),
      lineStart: this.getLine(node),
      lineEnd: node.endPosition.row + 1,
      decorators,
    };
  }

  private extractProperty(node: Parser.SyntaxNode, sourceCode: string): PropertyInfo {
    const nameNode = node.childForFieldName('property');
    const name = nameNode ? this.getText(nameNode, sourceCode) : 'unknownProperty';
    const typeNode = node.childForFieldName('type');

    return {
      name,
      type: typeNode ? this.getText(typeNode, sourceCode) : undefined,
      visibility: 'public',
      isStatic: this.getText(node, sourceCode).includes('static'),
      isReadonly: this.getText(node, sourceCode).includes('readonly'),
      lineNumber: this.getLine(node),
    };
  }

  private getDeclarationName(node: Parser.SyntaxNode, sourceCode: string): string | null {
    const nameNode = node.childForFieldName('name');
    return nameNode ? this.getText(nameNode, sourceCode) : null;
  }

  private getNodeKind(type: string): 'class' | 'interface' | 'function' | 'type_alias' | 'enum' | 'variable' {
    if (type.includes('class')) return 'class';
    if (type.includes('interface')) return 'interface';
    if (type.includes('function')) return 'function';
    if (type.includes('type_alias')) return 'type_alias';
    if (type.includes('enum')) return 'enum';
    return 'variable';
  }
}
