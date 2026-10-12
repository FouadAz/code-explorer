import * as path from 'path';
import {
  FileAnalysis,
  SymbolEntry,
  ImportInfo,
  ExportInfo,
  RawReference,
  GraphEdge,
} from '../types';

/**
 * Symbol table for cross-file reference resolution.
 */
export class SymbolTable {
  private symbols = new Map<string, SymbolEntry[]>();
  private fileExports = new Map<string, Map<string, SymbolEntry>>();

  /**
   * Build the symbol table from all file analyses.
   */
  build(analyses: FileAnalysis[]): void {
    this.symbols.clear();
    this.fileExports.clear();

    // First pass: collect all exported symbols
    for (const analysis of analyses) {
      const exports = new Map<string, SymbolEntry>();

      for (const exp of analysis.exports) {
        for (const node of analysis.nodes) {
          if (node.name === exp.name) {
            const entry: SymbolEntry = {
              name: exp.name,
              nodeId: node.id,
              filePath: analysis.filePath,
              kind: node.kind,
              exportName: exp.name,
              isDefault: exp.isDefault,
            };

            exports.set(exp.name, entry);
            this.addSymbol(exp.name, entry);
          }
        }
      }

      this.fileExports.set(analysis.filePath, exports);
    }
  }

  /**
   * Resolve an import to its source symbol.
   */
  resolveImport(
    importInfo: ImportInfo,
    fromFilePath: string,
  ): SymbolEntry[] {
    const resolvedPath = this.resolveModulePath(importInfo.source, fromFilePath);
    if (!resolvedPath) return [];

    const fileExports = this.fileExports.get(resolvedPath);
    if (!fileExports) return [];

    const results: SymbolEntry[] = [];

    for (const spec of importInfo.specifiers) {
      if (spec.name === '*') {
        // Namespace import: import all exports
        results.push(...Array.from(fileExports.values()));
      } else {
        const symbol = fileExports.get(spec.name);
        if (symbol) results.push(symbol);
      }
    }

    if (importInfo.isDefault) {
      const defaultSymbol = fileExports.get('default');
      if (defaultSymbol) results.push(defaultSymbol);
    }

    return results;
  }

  /**
   * Resolve a raw reference to a symbol.
   */
  resolveReference(name: string): SymbolEntry[] {
    return this.symbols.get(name) || [];
  }

  /**
   * Resolve a module path relative to the importing file.
   */
  private resolveModulePath(modulePath: string, fromFilePath: string): string | null {
    // Ignore external modules (node_modules)
    if (!modulePath.startsWith('.')) return null;

    const fromDir = path.dirname(fromFilePath);
    const resolved = path.join(fromDir, modulePath);

    // Try with common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this.fileExports.has(withExt)) return withExt;
    }

    // Try as directory with index file
    for (const ext of extensions) {
      const indexPath = path.join(resolved, 'index' + ext);
      if (this.fileExports.has(indexPath)) return indexPath;
    }

    // Try exact path
    if (this.fileExports.has(resolved)) return resolved;

    return null;
  }

  private addSymbol(name: string, entry: SymbolEntry): void {
    if (!this.symbols.has(name)) {
      this.symbols.set(name, []);
    }
    this.symbols.get(name)!.push(entry);
  }

  /**
   * Get all symbols.
   */
  getAllSymbols(): Map<string, SymbolEntry[]> {
    return this.symbols;
  }
}

/**
 * Cross-file reference resolver.
 */
export class ImportResolver {
  private symbolTable = new SymbolTable();

  /**
   * Resolve all imports and references across files.
   */
  resolve(analyses: FileAnalysis[]): GraphEdge[] {
    // Build symbol table
    this.symbolTable.build(analyses);

    const edges: GraphEdge[] = [];
    let edgeId = 0;

    // Resolve each file's imports and references
    for (const analysis of analyses) {
      // Resolve imports
      for (const imp of analysis.imports) {
        const resolved = this.symbolTable.resolveImport(imp, analysis.filePath);

        for (const symbol of resolved) {
          const sourceNode = analysis.nodes[0]; // Use first node or file-level
          if (sourceNode) {
            edges.push({
              id: `edge_${edgeId++}`,
              source: sourceNode.id,
              target: symbol.nodeId,
              kind: 'imports',
              confidence: 'definite',
              evidence: `import statement at line ${imp.line}`,
              sourceLocation: {
                file: analysis.filePath,
                line: imp.line,
              },
            });
          }
        }
      }

      // Resolve raw references
      for (const ref of analysis.rawReferences) {
        const resolved = this.symbolTable.resolveReference(ref.name);

        for (const symbol of resolved) {
          // Find the source node that contains this reference
          const sourceNode = analysis.nodes.find(
            n => n.lineStart <= ref.line && n.lineEnd >= ref.line,
          ) || analysis.nodes[0];

          if (sourceNode) {
            edges.push({
              id: `edge_${edgeId++}`,
              source: sourceNode.id,
              target: symbol.nodeId,
              kind: ref.kind,
              confidence: ref.confidence,
              evidence: ref.evidence,
              sourceLocation: {
                file: analysis.filePath,
                line: ref.line,
              },
            });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Get the symbol table.
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }
}
