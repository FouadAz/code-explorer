import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectGraph,
  ProjectMetadata,
  GraphNode,
  GraphEdge,
  FileAnalysis,
  ExplorerConfig,
} from '../types';

/**
 * Graph builder that constructs the final project graph.
 */
export class GraphBuilder {
  /**
   * Build a complete project graph from analysis results.
   */
  build(
    analyses: FileAnalysis[],
    edges: GraphEdge[],
    config: ExplorerConfig,
    scanDurationMs: number,
  ): ProjectGraph {
    // Collect all nodes
    const nodes: GraphNode[] = [];
    for (const analysis of analyses) {
      nodes.push(...analysis.nodes);
    }

    // Build metadata
    const languageCounts: Record<string, number> = {};
    for (const analysis of analyses) {
      languageCounts[analysis.language] = (languageCounts[analysis.language] || 0) + 1;
    }

    const metadata: ProjectMetadata = {
      projectPath: config.projectPath,
      analyzedAt: new Date().toISOString(),
      totalFiles: analyses.length,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      languages: languageCounts as any,
      scanDurationMs,
      configUsed: config,
    };

    return {
      nodes,
      edges,
      metadata,
    };
  }

  /**
   * Write graph to output directory.
   */
  writeGraph(graph: ProjectGraph, outputDir: string): void {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write main graph file
    const graphPath = path.join(outputDir, 'graph.json');
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8');

    // Write metadata separately for quick access
    const metaPath = path.join(outputDir, 'meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(graph.metadata, null, 2), 'utf-8');

    // Write symbols index for search
    const symbolsPath = path.join(outputDir, 'symbols.json');
    const symbols = graph.nodes.map(n => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      filePath: n.filePath,
      archRole: n.archRole,
    }));
    fs.writeFileSync(symbolsPath, JSON.stringify(symbols, null, 2), 'utf-8');

    // Write files index
    const filesPath = path.join(outputDir, 'files.json');
    const filesByPath = new Map<string, GraphNode[]>();
    for (const node of graph.nodes) {
      if (!filesByPath.has(node.filePath)) {
        filesByPath.set(node.filePath, []);
      }
      filesByPath.get(node.filePath)!.push(node);
    }

    const filesIndex = Array.from(filesByPath.entries()).map(([filePath, nodes]) => ({
      filePath,
      language: nodes[0]?.language || 'unknown',
      nodeCount: nodes.length,
      linesOfCode: nodes.reduce((sum, n) => sum + n.linesOfCode, 0),
    }));

    fs.writeFileSync(filesPath, JSON.stringify(filesIndex, null, 2), 'utf-8');

    console.log(`\nGraph written to: ${outputDir}/`);
    console.log(`  - graph.json: Complete graph with ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    console.log(`  - meta.json: Project metadata`);
    console.log(`  - symbols.json: Symbol index (${symbols.length} symbols)`);
    console.log(`  - files.json: File index (${filesIndex.length} files)`);
  }

  /**
   * Calculate graph metrics (centrality, coupling, etc.)
   */
  calculateMetrics(graph: ProjectGraph): Map<string, GraphMetrics> {
    const metrics = new Map<string, GraphMetrics>();

    // Build adjacency lists
    const inbound = new Map<string, string[]>();
    const outbound = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (!outbound.has(edge.source)) outbound.set(edge.source, []);
      if (!inbound.has(edge.target)) inbound.set(edge.target, []);
      outbound.get(edge.source)!.push(edge.target);
      inbound.get(edge.target)!.push(edge.source);
    }

    // Calculate metrics for each node
    for (const node of graph.nodes) {
      const inDegree = inbound.get(node.id)?.length || 0;
      const outDegree = outbound.get(node.id)?.length || 0;

      metrics.set(node.id, {
        inDegree,
        outDegree,
        totalDegree: inDegree + outDegree,
        // Simple centrality: normalized degree
        centrality: (inDegree + outDegree) / graph.nodes.length,
      });
    }

    return metrics;
  }
}

/** Graph metrics for a node */
export interface GraphMetrics {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  centrality: number;
}
