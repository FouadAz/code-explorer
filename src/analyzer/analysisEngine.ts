import * as fs from 'fs';
import * as path from 'path';
import { ExplorerConfig, FileAnalysis, Language } from '../types';
import { ScannedFile } from '../scanner/fileScanner';
import { getParser, parseSource, countLinesOfCode, initializeParser } from '../parser/parserManager';
import { AstCache } from '../parser/astCache';
import { TypeScriptExtractor } from '../extractors/typescript';
import { JavaExtractor } from '../extractors/java';
import { Extractor } from '../extractors/base';

/**
 * Analysis engine that coordinates scanning, parsing, and extraction.
 */
export class AnalysisEngine {
  private cache: AstCache;
  private extractors: Map<Language, Extractor>;

  constructor(private config: ExplorerConfig) {
    this.cache = new AstCache(config.outputDir);
    this.extractors = new Map();

    // Register extractors
    const tsExtractor = new TypeScriptExtractor();
    this.extractors.set('typescript', tsExtractor);
    this.extractors.set('javascript', tsExtractor); // JS uses same extractor

    const javaExtractor = new JavaExtractor();
    this.extractors.set('java', javaExtractor);
  }

  /**
   * Initialize the analysis engine (load Tree-sitter WASM).
   */
  async initialize(): Promise<void> {
    await initializeParser();
  }

  /**
   * Analyze a batch of files and return their analysis results.
   */
  async analyzeFiles(
    files: ScannedFile[],
    onProgress?: (current: number, total: number, file: string) => void,
  ): Promise<FileAnalysis[]> {
    const results: FileAnalysis[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (onProgress) {
        onProgress(i + 1, files.length, file.relativePath);
      }

      try {
        const analysis = await this.analyzeFile(file);
        results.push(analysis);
      } catch (err) {
        console.error(`Failed to analyze ${file.relativePath}: ${(err as Error).message}`);
        // Push empty analysis with error
        results.push({
          filePath: file.relativePath,
          language: file.language,
          imports: [],
          exports: [],
          nodes: [],
          rawReferences: [],
          errors: [(err as Error).message],
          linesOfCode: 0,
          hash: '',
        });
      }
    }

    return results;
  }

  /**
   * Analyze a single file.
   */
  private async analyzeFile(file: ScannedFile): Promise<FileAnalysis> {
    // Read file content
    const sourceCode = fs.readFileSync(file.absolutePath, 'utf-8');
    const contentHash = AstCache.hashContent(sourceCode);

    // Check cache
    const cached = this.cache.get(file.absolutePath, contentHash);
    if (cached) {
      return cached;
    }

    // Get parser for this language
    const languageParser = await getParser(file.language);
    if (!languageParser) {
      throw new Error(`No parser available for language: ${file.language}`);
    }

    // Parse the source code
    const tree = parseSource(sourceCode, languageParser);

    // Get extractor for this language
    const extractor = this.extractors.get(file.language);
    if (!extractor) {
      throw new Error(`No extractor available for language: ${file.language}`);
    }

    // Extract structural information
    const analysis = extractor.extract(tree, sourceCode, file.relativePath, file.language);

    // Cache the result
    this.cache.set(file.absolutePath, contentHash, analysis);

    return analysis;
  }

  /**
   * Clear the analysis cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
