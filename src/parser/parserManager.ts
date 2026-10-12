import Parser from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';
import { Language } from '../types';

/** Tree-sitter parser instance with language grammar */
export interface LanguageParser {
  parser: Parser;
  language: Language;
}

/** Global parser cache */
const parserCache = new Map<Language, LanguageParser>();
let wasmInitialized = false;

/** Language to WASM file mapping */
const LANGUAGE_WASM_MAP: Record<Language, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  java: 'tree-sitter-java.wasm',
  unknown: '',
};

/**
 * Initialize the Tree-sitter WASM runtime.
 * Must be called before any parsing operations.
 */
export async function initializeParser(): Promise<void> {
  if (wasmInitialized) return;

  try {
    await Parser.init();
    wasmInitialized = true;
  } catch (err) {
    throw new Error(`Failed to initialize Tree-sitter WASM: ${(err as Error).message}`);
  }
}

/**
 * Get or create a parser for the specified language.
 */
export async function getParser(language: Language): Promise<LanguageParser | null> {
  if (language === 'unknown') return null;

  // Return cached parser if available
  if (parserCache.has(language)) {
    return parserCache.get(language)!;
  }

  // Ensure WASM is initialized
  if (!wasmInitialized) {
    await initializeParser();
  }

  // Create new parser
  const parser = new Parser();
  const wasmFile = LANGUAGE_WASM_MAP[language];

  if (!wasmFile) {
    throw new Error(`No WASM grammar available for language: ${language}`);
  }

  // Try to load the WASM grammar from node_modules
  const wasmPath = findWasmFile(wasmFile);

  if (!wasmPath) {
    console.warn(`WASM grammar not found for ${language}, skipping files with this language`);
    return null;
  }

  try {
    const langGrammar = await Parser.Language.load(wasmPath);
    parser.setLanguage(langGrammar);

    const languageParser: LanguageParser = {
      parser,
      language,
    };

    parserCache.set(language, languageParser);
    return languageParser;
  } catch (err) {
    console.warn(`Failed to load ${language} grammar: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Parse source code and return the AST.
 */
export function parseSource(
  sourceCode: string,
  languageParser: LanguageParser,
): Parser.Tree {
  return languageParser.parser.parse(sourceCode);
}

/**
 * Find the WASM file in node_modules or fallback locations.
 */
function findWasmFile(filename: string): string | null {
  const possiblePaths = [
    // Primary: tree-sitter-wasms package (pre-built WASM files)
    path.join(__dirname, '../../node_modules/tree-sitter-wasms/out', filename),
    // Fallback: local wasm directory (for bundled distributions)
    path.join(__dirname, '../../wasm', filename),
  ];

  for (const wasmPath of possiblePaths) {
    if (fs.existsSync(wasmPath)) {
      return wasmPath;
    }
  }

  return null;
}

/**
 * Count lines of code (non-blank, non-comment).
 * This is a simple heuristic; comment detection could be improved with AST.
 */
export function countLinesOfCode(sourceCode: string): number {
  const lines = sourceCode.split('\n');
  let loc = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    loc++;
  }

  return loc;
}
