import { ExplorerConfig, Language } from '../types';

/** Default configuration values */
export const DEFAULT_CONFIG: Omit<ExplorerConfig, 'projectPath'> = {
  exclude: [
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '__pycache__', '.venv', 'venv', 'target', '.idea',
    '.vscode', '.explorer', '*.min.js', '*.min.css',
    '*.map', '*.lock', 'package-lock.json', 'yarn.lock',
    '.next', '.nuxt', '.output', 'out', 'vendor',
    '.gradle', '.mvn', 'bin', 'obj',
  ],
  maxFileSize: 1_048_576, // 1MB
  maxFiles: 10_000,
  outputDir: '.explorer',
};

/** Valid language identifiers */
export const VALID_LANGUAGES: Language[] = [
  'typescript', 'javascript', 'python', 'java',
];

/** File extension to language mapping */
export const EXTENSION_MAP: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.java': 'java',
};

/** Configuration validation error */
export class ConfigError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
