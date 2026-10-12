const API_BASE = '/api';

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: ProjectMetadata;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  language: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  packageName?: string;
  archRole: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  decorators: string[];
  linesOfCode: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: string;
  confidence: string;
  evidence: string;
  sourceLocation?: { file: string; line: number };
}

export interface ProjectMetadata {
  projectPath: string;
  analyzedAt: string;
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  languages: Record<string, number>;
  scanDurationMs: number;
}

export interface MethodInfo {
  name: string;
  parameters: any[];
  returnType?: string;
  visibility: string;
  isStatic: boolean;
  isAsync: boolean;
  lineStart: number;
  lineEnd: number;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: string;
  isStatic: boolean;
  lineNumber: number;
}

export interface SearchResult {
  nodeId: string;
  name: string;
  kind: string;
  filePath: string;
  score: number;
  matchField: string;
}

export interface ImpactAnalysis {
  nodeId: string;
  upstream: string[];
  downstream: string[];
}

class ApiClient {
  async fetchGraph(): Promise<ProjectGraph> {
    const response = await fetch(`${API_BASE}/graph`);
    if (!response.ok) throw new Error('Failed to fetch graph');
    return response.json();
  }

  async fetchMeta(): Promise<ProjectMetadata> {
    const response = await fetch(`${API_BASE}/meta`);
    if (!response.ok) throw new Error('Failed to fetch metadata');
    return response.json();
  }

  async fetchNode(nodeId: string): Promise<{ node: GraphNode; edges: GraphEdge[] }> {
    const response = await fetch(`${API_BASE}/node/${nodeId}`);
    if (!response.ok) throw new Error('Failed to fetch node');
    return response.json();
  }

  async search(query: string): Promise<SearchResult[]> {
    const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    return response.json();
  }

  async fetchImpact(nodeId: string): Promise<ImpactAnalysis> {
    const response = await fetch(`${API_BASE}/impact/${nodeId}`);
    if (!response.ok) throw new Error('Failed to fetch impact analysis');
    return response.json();
  }
}

export const api = new ApiClient();
