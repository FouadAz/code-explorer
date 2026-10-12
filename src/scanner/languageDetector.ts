import * as path from 'path';
import { Language } from '../types';
import { EXTENSION_MAP } from '../config/schema';

/**
 * Detect the programming language of a file based on its extension.
 */
export function detectLanguage(filePath: string): Language {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || 'unknown';
}

/**
 * Check if a file extension is supported for analysis.
 */
export function isSupportedFile(filePath: string): boolean {
  return detectLanguage(filePath) !== 'unknown';
}

/**
 * Get all supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}
