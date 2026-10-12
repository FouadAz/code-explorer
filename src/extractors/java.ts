import Parser from 'web-tree-sitter';
import { BaseExtractor } from './base';
import { FileAnalysis, GraphNode, ImportInfo, ExportInfo, RawReference, Language, NodeKind, PropertyInfo, MethodInfo, ParameterInfo } from '../types';

/**
 * Extract Java class/interface structure.
 */
export class JavaExtractor extends BaseExtractor {
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

    // Visit import declarations
    this.walkTree(tree.rootNode, (node) => {
      if (node.type === 'import_declaration') {
        this.extractImport(node, sourceCode, imports);
      } else if (
        node.type === 'class_declaration' ||
        node.type === 'interface_declaration' ||
        node.type === 'enum_declaration' ||
        node.type === 'record_declaration'
      ) {
        const classNode = this.extractClass(node, sourceCode, filePath, language);
        if (classNode) {
          nodes.push(classNode);

          // Extract references from within this class
          this.extractReferences(node, sourceCode, filePath, rawReferences);
        }
      }
    });

    // All public classes in Java are implicitly exported
    for (const node of nodes) {
      exports.push({
        name: node.name,
        isDefault: false,
        kind: node.kind,
        line: node.lineStart,
      });
    }

    // Extract package declaration (exported classes are determined later)
    // Package info is stored in nodes, not exports

    // Count lines of code (simplified - could be improved)
    const lines = sourceCode.split('\n');
    let loc = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
      loc++;
    }

    return {
      filePath,
      language,
      imports,
      exports,
      nodes,
      rawReferences,
      errors,
      linesOfCode: loc,
      hash: '', // Would need a hash function
    };
  }

  private extractImport(
    node: Parser.SyntaxNode,
    sourceCode: string,
    imports: ImportInfo[],
  ): void {
    const identifier = this.findChild(node, 'scoped_identifier');
    if (identifier) {
      const importPath = this.getText(identifier, sourceCode);
      const className = importPath.split('.').pop() || importPath;
      imports.push({
        source: importPath,
        specifiers: [{ name: className }],
        isDefault: false,
        isNamespace: false,
        isSideEffect: false,
        line: node.startPosition.row + 1,
      });
    }
  }

  private extractClass(
    node: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): GraphNode | null {
    const nameNode = this.findChild(node, 'identifier');
    if (!nameNode) return null;

    const name = this.getText(nameNode, sourceCode);
    const line = node.startPosition.row + 1;
    const decorators = this.extractJavaDecorators(node, sourceCode);

    let kind: NodeKind = 'class';
    if (node.type === 'interface_declaration') {
      kind = 'interface';
    } else if (node.type === 'enum_declaration') {
      kind = 'enum';
    }

    // Extract modifiers
    const modifiers: string[] = [];
    this.walkTree(node, (child) => {
      if (child.type === 'modifiers') {
        for (const modChild of child.children) {
          if (modChild.type === 'public' || modChild.type === 'private' ||
              modChild.type === 'protected' || modChild.type === 'static' ||
              modChild.type === 'final' || modChild.type === 'abstract' ||
              modChild.type === 'sealed' || modChild.type === 'non-sealed') {
            modifiers.push(modChild.type);
          }
        }
      }
    });

    // Extract type parameters
    const typeParameters: string[] = [];
    const typeParamsNode = this.findChild(node, 'type_parameters');
    if (typeParamsNode) {
      this.walkTree(typeParamsNode, (typeParamNode) => {
        if (typeParamNode.type === 'type_parameter') {
          const typeParamName = this.findChild(typeParamNode, 'identifier');
          if (typeParamName) {
            typeParameters.push(this.getText(typeParamName, sourceCode));
          }
        }
      });
    }

    // Extract extends/implements
    const superTypes: string[] = [];
    const extendsNode = this.findChild(node, 'superclass');
    if (extendsNode) {
      const typeNode = this.findChild(extendsNode, 'type_identifier') ||
                      this.findChild(extendsNode, 'scoped_type_identifier');
      if (typeNode) {
        superTypes.push(this.getText(typeNode, sourceCode));
      }
    }

    const implementsNode = this.findChild(node, 'super_interfaces');
    if (implementsNode) {
      this.walkTree(implementsNode, (typeListNode) => {
        if (typeListNode.type === 'type_identifier' ||
            typeListNode.type === 'scoped_type_identifier' ||
            typeListNode.type === 'generic_type') {
          superTypes.push(this.getText(typeListNode, sourceCode));
        }
      });
    }

    // Extract properties (fields)
    const properties: PropertyInfo[] = [];
    this.walkTree(node, (child) => {
      if (child.type === 'field_declaration') {
        const fieldName = this.findChild(child, 'identifier');
        const fieldType = this.findChild(child, 'type_identifier') ||
                         this.findChild(child, 'scoped_type_identifier') ||
                         this.findChild(child, 'array_type') ||
                         this.findChild(child, 'generic_type');

        if (fieldName) {
          let visibility: 'public' | 'private' | 'protected' | 'default' = 'default';
          let isStatic = false;
          let isReadonly = false;

          // Check modifiers for visibility and other flags
          const modifiersNode = this.findChild(child, 'modifiers');
          if (modifiersNode) {
            for (const modChild of modifiersNode.children) {
              if (modChild.type === 'public') visibility = 'public';
              else if (modChild.type === 'private') visibility = 'private';
              else if (modChild.type === 'protected') visibility = 'protected';
              else if (modChild.type === 'static') isStatic = true;
              else if (modChild.type === 'final') isReadonly = true;
            }
          }

          properties.push({
            name: this.getText(fieldName, sourceCode),
            type: fieldType ? this.getText(fieldType, sourceCode) : undefined,
            visibility,
            isStatic,
            isReadonly,
            lineNumber: child.startPosition.row + 1
          });
        }
      }
    });

    // Extract methods
    const methods: MethodInfo[] = [];
    this.walkTree(node, (child) => {
      if (child.type === 'method_declaration' || child.type === 'constructor_declaration') {
        const methodName = this.findChild(child, 'identifier');
        const returnType = this.findChild(child, 'type_identifier') ||
                          this.findChild(child, 'scoped_type_identifier') ||
                          this.findChild(child, 'void_type') ||
                          this.findChild(child, 'array_type') ||
                          this.findChild(child, 'generic_type');

        if (methodName) {
          // Extract parameters
          const parameters: ParameterInfo[] = [];
          const formalParams = this.findChild(child, 'formal_parameters');
          if (formalParams) {
            this.walkTree(formalParams, (paramChild) => {
              if (paramChild.type === 'formal_parameter') {
                const paramName = this.findChild(paramChild, 'identifier');
                const paramType = this.findChild(paramChild, 'type_identifier') ||
                                 this.findChild(paramChild, 'scoped_type_identifier') ||
                                 this.findChild(paramChild, 'array_type') ||
                                 this.findChild(paramChild, 'generic_type');

                if (paramName) {
                  parameters.push({
                    name: this.getText(paramName, sourceCode),
                    type: paramType ? this.getText(paramType, sourceCode) : undefined,
                    isOptional: false
                  });
                }
              }
            });
          }

          let visibility: 'public' | 'private' | 'protected' | 'default' = 'public';
          let isStatic = false;
          let isAbstract = false;

          // Check modifiers for visibility and other flags
          const modifiersNode = this.findChild(child, 'modifiers');
          if (modifiersNode) {
            for (const modChild of modifiersNode.children) {
              if (modChild.type === 'public') visibility = 'public';
              else if (modChild.type === 'private') visibility = 'private';
              else if (modChild.type === 'protected') visibility = 'protected';
              else if (modChild.type === 'static') isStatic = true;
              else if (modChild.type === 'abstract') isAbstract = true;
            }
          }

          const methodDecorators = this.extractJavaDecorators(child, sourceCode);

          methods.push({
            name: this.getText(methodName, sourceCode),
            parameters,
            visibility,
            returnType: returnType ? this.getText(returnType, sourceCode) : undefined,
            isStatic,
            isAsync: false, // Java doesn't have async/await like JS/TS
            isAbstract,
            lineStart: child.startPosition.row + 1,
            lineEnd: child.endPosition.row + 1,
            decorators: methodDecorators
          });
        }
      }
    });

    // Determine architectural role
    const archRole = this.determineArchRole(name, decorators);

    return {
      id: this.generateNodeId(filePath, name, line),
      name,
      kind,
      filePath,
      lineStart: line,
      lineEnd: node.endPosition.row + 1,
      language,
      archRole,
      packageName: undefined, // Will be resolved from imports/package
      decorators,
      properties,
      methods,
      linesOfCode: node.endPosition.row + 1 - line,
    };
  }

  private extractJavaDecorators(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const decorators: string[] = [];
    this.walkTree(node, (child) => {
      // Check for Java annotations (@Service, @RestController, etc.)
      if (child.type === 'marker_annotation' || child.type === 'annotation') {
        const identifier = this.findChild(child, 'identifier');
        if (identifier) {
          decorators.push('@' + this.getText(identifier, sourceCode));
        }
      }
    });
    return decorators;
  }

  /**
   * Extract references to other classes (method calls, field access, instantiations)
   */
  private extractReferences(
    classNode: Parser.SyntaxNode,
    sourceCode: string,
    filePath: string,
    rawReferences: RawReference[]
  ): void {
    this.walkTree(classNode, (node) => {
      // Method invocations - captures method calls
      if (node.type === 'method_invocation') {
        const objectNode = this.findChild(node, 'identifier') || this.findChild(node, 'field_access');
        const methodNameNode = this.findChild(node, 'identifier');

        if (methodNameNode) {
          const methodName = this.getText(methodNameNode, sourceCode);
          rawReferences.push({
            name: methodName,
            kind: 'calls',
            line: node.startPosition.row + 1,
            confidence: 'high',
            evidence: `method call at line ${node.startPosition.row + 1}`
          });
        }
      }

      // Object creation expressions - captures "new ClassName()"
      if (node.type === 'object_creation_expression') {
        const typeNode = this.findChild(node, 'type_identifier') ||
                        this.findChild(node, 'scoped_type_identifier') ||
                        this.findChild(node, 'generic_type');

        if (typeNode) {
          const className = this.getText(typeNode, sourceCode);
          rawReferences.push({
            name: className,
            kind: 'instantiates',
            line: node.startPosition.row + 1,
            confidence: 'definite',
            evidence: `instantiation at line ${node.startPosition.row + 1}`
          });
        }
      }

      // Field access - captures field references
      if (node.type === 'field_access') {
        const fieldNode = this.findChild(node, 'identifier');
        if (fieldNode) {
          const fieldName = this.getText(fieldNode, sourceCode);
          rawReferences.push({
            name: fieldName,
            kind: 'depends_on',
            line: node.startPosition.row + 1,
            confidence: 'medium',
            evidence: `field access at line ${node.startPosition.row + 1}`
          });
        }
      }

      // Type references in variable declarations
      if (node.type === 'local_variable_declaration' || node.type === 'field_declaration') {
        const typeNode = this.findChild(node, 'type_identifier') ||
                        this.findChild(node, 'scoped_type_identifier') ||
                        this.findChild(node, 'generic_type');

        if (typeNode) {
          const typeName = this.getText(typeNode, sourceCode);
          // Extract just the class name from generic types like List<User>
          const simpleTypeName = typeName.split('<')[0].trim();
          rawReferences.push({
            name: simpleTypeName,
            kind: 'type_references',
            line: node.startPosition.row + 1,
            confidence: 'definite',
            evidence: `type reference at line ${node.startPosition.row + 1}`
          });
        }
      }
    });
  }
}
