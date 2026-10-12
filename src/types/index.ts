// Core type definitions for Code Explorer

/** Supported programming languages */
export type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'unknown';

/** Confidence level for discovered relationships */
export type Confidence = 'definite' | 'high' | 'medium' | 'inferred';

/** Types of graph nodes */
export type NodeKind =
  | 'class'
  | 'interface'
  | 'abstract_class'
  | 'enum'
  | 'function'
  | 'method'
  | 'module'
  | 'package'
  | 'file'
  | 'entry_point'
  | 'route'
  | 'decorator'
  | 'type_alias'
  | 'variable';

/** Types of relationships between nodes */
export type EdgeKind =
  | 'imports'
  | 'exports'
  | 'inherits'
  | 'implements'
  | 'composes'         // has-a (field type)
  | 'aggregates'       // collection of
  | 'calls'            // method/function call
  | 'instantiates'     // new X()
  | 'decorates'        // @decorator
  | 'type_references'  // used as type
  | 'depends_on'       // general dependency
  | 'injects';         // dependency injection

/** Architectural role of a component */
export type ArchRole =
  | 'controller'
  | 'service'
  | 'repository'
  | 'model'
  | 'middleware'
  | 'utility'
  | 'config'
  | 'test'
  | 'entry_point'
  | 'unknown';

/** A method or function signature */
export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  visibility: 'public' | 'private' | 'protected' | 'default';
  isStatic: boolean;
  isAsync: boolean;
  isAbstract: boolean;
  lineStart: number;
  lineEnd: number;
  decorators: string[];
}

/** A parameter in a method/function */
export interface ParameterInfo {
  name: string;
  type?: string;
  defaultValue?: string;
  isOptional: boolean;
}

/** A property/field on a class */
export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected' | 'default';
  isStatic: boolean;
  isReadonly: boolean;
  lineNumber: number;
}

/** A node in the architecture graph */
export interface GraphNode {
  id: string;
  name: string;
  kind: NodeKind;
  language: Language;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  packageName?: string;
  archRole: ArchRole;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  decorators: string[];
  documentation?: string;
  linesOfCode: number;
  /** Parent node ID for nested declarations */
  parentId?: string;
}

/** An edge in the architecture graph */
export interface GraphEdge {
  id: string;
  source: string;  // node ID
  target: string;  // node ID
  kind: EdgeKind;
  confidence: Confidence;
  /** How this relationship was discovered */
  evidence: string;
  /** Source location of this reference */
  sourceLocation?: {
    file: string;
    line: number;
  };
  label?: string;
}

/** The complete project graph */
export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: ProjectMetadata;
}

/** Project-level metadata */
export interface ProjectMetadata {
  projectPath: string;
  analyzedAt: string;
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  languages: Record<Language, number>;
  scanDurationMs: number;
  configUsed: ExplorerConfig;
}

/** An import declaration found in source */
export interface ImportInfo {
  /** The module specifier (e.g., './foo', 'express') */
  source: string;
  /** Named imports: { originalName, alias? } */
  specifiers: { name: string; alias?: string }[];
  /** Whether it's a default import */
  isDefault: boolean;
  /** Whether it's a namespace import (import * as X) */
  isNamespace: boolean;
  /** Whether it's side-effect only (import './styles.css') */
  isSideEffect: boolean;
  /** Line number */
  line: number;
}

/** An export declaration found in source */
export interface ExportInfo {
  name: string;
  isDefault: boolean;
  kind: NodeKind;
  line: number;
}

/** Extracted data from a single source file */
export interface FileAnalysis {
  filePath: string;
  language: Language;
  imports: ImportInfo[];
  exports: ExportInfo[];
  nodes: GraphNode[];
  /** Raw references to other symbols (unresolved) */
  rawReferences: RawReference[];
  errors: string[];
  linesOfCode: number;
  hash: string;
}

/** An unresolved reference to another symbol */
export interface RawReference {
  /** The name being referenced */
  name: string;
  /** Type of reference */
  kind: EdgeKind;
  /** Where the reference occurs */
  line: number;
  /** Confidence of this reference */
  confidence: Confidence;
  /** Context or evidence */
  evidence: string;
}

/** Tool configuration */
export interface ExplorerConfig {
  projectPath: string;
  exclude: string[];
  include?: string[];
  languages?: Language[];
  entryPoints?: string[];
  maxFileSize: number;
  maxFiles: number;
  outputDir: string;
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    apiKey?: string;
  };
}

/** Symbol table entry for cross-file resolution */
export interface SymbolEntry {
  name: string;
  nodeId: string;
  filePath: string;
  kind: NodeKind;
  exportName?: string;
  isDefault: boolean;
}

/** Execution flow step */
export interface FlowStep {
  nodeId: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  line: number;
  confidence: Confidence;
  children: FlowStep[];
}

/** Execution flow from an entry point */
export interface ExecutionFlow {
  entryPointId: string;
  entryPointName: string;
  steps: FlowStep[];
}

/** Search result */
export interface SearchResult {
  nodeId: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  score: number;
  matchField: 'name' | 'file' | 'method' | 'property';
}
