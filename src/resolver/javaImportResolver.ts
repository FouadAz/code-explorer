import * as path from 'path';
import {
  FileAnalysis,
  SymbolEntry,
  GraphEdge,
} from '../types';

/**
 * Java-specific import resolver that handles fully-qualified class names
 * and Java package structure.
 */
export class JavaImportResolver {
  private classNameToSymbol = new Map<string, SymbolEntry>();
  private fullyQualifiedToSymbol = new Map<string, SymbolEntry>();

  /**
   * Resolve all imports and references across Java files.
   */
  resolve(analyses: FileAnalysis[]): GraphEdge[] {
    // Build symbol tables
    this.buildSymbolTable(analyses);

    const edges: GraphEdge[] = [];
    let edgeId = 0;

    // Resolve each file's imports and references
    for (const analysis of analyses) {
      if (analysis.language !== 'java') continue;

      // Build import map for this file (short name -> full name)
      const importMap = new Map<string, string>();
      for (const imp of analysis.imports) {
        const className = imp.source.split('.').pop();
        if (className) {
          importMap.set(className, imp.source);
        }
      }

      // Resolve raw references (method calls, instantiations, etc.)
      for (const ref of analysis.rawReferences) {
        // Try to resolve the reference
        let targetSymbol: SymbolEntry | undefined;

        // First, check if it's imported (full qualified name available)
        if (importMap.has(ref.name)) {
          const fullName = importMap.get(ref.name)!;
          targetSymbol = this.fullyQualifiedToSymbol.get(fullName);
        }

        // If not found via imports, try by simple class name
        if (!targetSymbol) {
          targetSymbol = this.classNameToSymbol.get(ref.name);
        }

        if (targetSymbol) {
          // Find the source node that contains this reference
          const sourceNode = analysis.nodes.find(
            n => n.lineStart <= ref.line && n.lineEnd >= ref.line,
          ) || analysis.nodes[0];

          if (sourceNode && sourceNode.id !== targetSymbol.nodeId) {
            edges.push({
              id: `edge_${edgeId++}`,
              source: sourceNode.id,
              target: targetSymbol.nodeId,
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

      // Create import edges for each import statement
      for (const imp of analysis.imports) {
        const targetSymbol = this.fullyQualifiedToSymbol.get(imp.source);

        if (targetSymbol && analysis.nodes[0]) {
          edges.push({
            id: `edge_${edgeId++}`,
            source: analysis.nodes[0].id,
            target: targetSymbol.nodeId,
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

    return edges;
  }

  /**
   * Build symbol tables from all Java files.
   */
  private buildSymbolTable(analyses: FileAnalysis[]): void {
    this.classNameToSymbol.clear();
    this.fullyQualifiedToSymbol.clear();

    for (const analysis of analyses) {
      if (analysis.language !== 'java') continue;

      // Extract package name from file path or imports
      const packageName = this.extractPackageName(analysis);

      for (const node of analysis.nodes) {
        const entry: SymbolEntry = {
          name: node.name,
          nodeId: node.id,
          filePath: analysis.filePath,
          kind: node.kind,
          isDefault: false,
        };

        // Register by simple class name
        this.classNameToSymbol.set(node.name, entry);

        // Register by fully qualified name if we know the package
        if (packageName) {
          const fullyQualified = `${packageName}.${node.name}`;
          this.fullyQualifiedToSymbol.set(fullyQualified, entry);
        }
      }
    }
  }

  /**
   * Extract package name from Java file analysis.
   * Infers from file path (e.g., com/service/UserService.java -> com.service)
   */
  private extractPackageName(analysis: FileAnalysis): string | null {
    // Try to infer from file path
    // Java convention: src/main/java/com/example/service/MyClass.java
    const filePath = analysis.filePath.replace(/\\/g, '/');

    // Look for common Java source directory patterns
    const patterns = [
      /src\/main\/java\/(.+)\//,
      /src\/test\/java\/(.+)\//,
      /java\/(.+)\//,
    ];

    for (const pattern of patterns) {
      const match = filePath.match(pattern);
      if (match) {
        return match[1].replace(/\//g, '.');
      }
    }

    return null;
  }
}
