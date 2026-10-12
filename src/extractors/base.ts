import * as Parser from 'web-tree-sitter';
import { FileAnalysis, GraphNode, ImportInfo, ExportInfo, RawReference, Language } from '../types';

/**
 * Base interface for language-specific extractors.
 */
export interface Extractor {
  /**
   * Extract structural information from a parsed AST.
   */
  extract(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): FileAnalysis;
}

/**
 * Base extractor with common utilities.
 */
export abstract class BaseExtractor implements Extractor {
  abstract extract(
    tree: Parser.Tree,
    sourceCode: string,
    filePath: string,
    language: Language,
  ): FileAnalysis;

  /**
   * Get the text content of a node.
   */
  protected getText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  /**
   * Get line number (1-indexed) for a position.
   */
  protected getLine(node: Parser.SyntaxNode): number {
    return node.startPosition.row + 1;
  }

  /**
   * Find child node by type.
   */
  protected findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
    for (const child of node.children) {
      if (child.type === type) return child;
    }
    return null;
  }

  /**
   * Find all children of a specific type.
   */
  protected findChildren(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    return node.children.filter(c => c.type === type);
  }

  /**
   * Extract decorator/annotation names from a node.
   */
  protected extractDecorators(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const decorators: string[] = [];
    for (const child of node.children) {
      if (child.type === 'decorator' || child.type === 'annotation') {
        const text = this.getText(child, sourceCode);
        decorators.push(text.replace(/^[@()]|[()]/g, '').trim());
      }
    }
    return decorators;
  }

  /**
   * Generate a unique node ID.
   */
  protected generateNodeId(filePath: string, name: string, line: number): string {
    const fileHash = filePath.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const nameHash = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${fileHash}_${nameHash}_${line}`;
  }

  /**
   * Determine architectural role from decorators and naming.
   */
  protected determineArchRole(
    name: string,
    decorators: string[],
  ): 'controller' | 'service' | 'repository' | 'model' | 'middleware' | 'utility' | 'config' | 'test' | 'entry_point' | 'unknown' {
    const lowerName = name.toLowerCase();
    const decoratorStr = decorators.join(' ').toLowerCase();

    if (decoratorStr.includes('controller') || lowerName.endsWith('controller')) {
      return 'controller';
    }
    if (decoratorStr.includes('service') || lowerName.endsWith('service')) {
      return 'service';
    }
    if (decoratorStr.includes('repository') || lowerName.endsWith('repository')) {
      return 'repository';
    }
    if (decoratorStr.includes('entity') || decoratorStr.includes('model') || lowerName.endsWith('model')) {
      return 'model';
    }
    if (decoratorStr.includes('middleware') || lowerName.includes('middleware')) {
      return 'middleware';
    }
    if (lowerName === 'main' || lowerName === 'app' || lowerName === 'index') {
      return 'entry_point';
    }
    if (lowerName.includes('util') || lowerName.includes('helper')) {
      return 'utility';
    }
    if (lowerName.includes('config') || lowerName.includes('settings')) {
      return 'config';
    }
    if (lowerName.includes('test') || lowerName.includes('spec')) {
      return 'test';
    }

    return 'unknown';
  }

  /**
   * Visit all nodes in the tree recursively.
   */
  protected walkTree(
    node: Parser.SyntaxNode,
    visitor: (node: Parser.SyntaxNode) => void,
  ): void {
    visitor(node);
    for (const child of node.children) {
      this.walkTree(child, visitor);
    }
  }
}
