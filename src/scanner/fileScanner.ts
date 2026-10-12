import * as fs from 'fs';
import * as path from 'path';
import { ExplorerConfig, Language } from '../types';
import { detectLanguage, isSupportedFile } from './languageDetector';
import ignore, { Ignore } from 'ignore';

/** A discovered source file */
export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  language: Language;
  sizeBytes: number;
  lastModified: number;
}

/** Result of a project scan */
export interface ScanResult {
  files: ScannedFile[];
  skippedCount: number;
  skippedReasons: Map<string, number>;
  totalSizeBytes: number;
  languageCounts: Record<string, number>;
  durationMs: number;
}

/**
 * Recursively scan a project directory for source files.
 */
export function scanProject(config: ExplorerConfig): ScanResult {
  const startTime = Date.now();
  const projectRoot = path.resolve(config.projectPath);

  if (!fs.existsSync(projectRoot)) {
    throw new Error(`Project directory does not exist: ${projectRoot}`);
  }

  const ig = buildIgnoreFilter(config, projectRoot);
  const files: ScannedFile[] = [];
  const skippedReasons = new Map<string, number>();
  let skippedCount = 0;

  function incrementSkip(reason: string): void {
    skippedCount++;
    skippedReasons.set(reason, (skippedReasons.get(reason) || 0) + 1);
  }

  function walk(dirPath: string): void {
    if (files.length >= config.maxFiles) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      incrementSkip('unreadable_directory');
      return;
    }

    for (const entry of entries) {
      if (files.length >= config.maxFiles) break;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(projectRoot, fullPath);

      // Use forward slashes for ignore matching
      const relPathForward = relPath.replace(/\\/g, '/');

      if (entry.isDirectory()) {
        // Check if directory should be ignored
        if (ig.ignores(relPathForward + '/')) {
          incrementSkip('excluded_directory');
          continue;
        }

        // If include list is set, check if this directory is under an included path
        if (config.include && config.include.length > 0) {
          const isIncluded = config.include.some(inc => {
            const incNorm = inc.replace(/\\/g, '/');
            return relPathForward.startsWith(incNorm) || incNorm.startsWith(relPathForward);
          });
          if (!isIncluded) {
            incrementSkip('not_in_include_list');
            continue;
          }
        }

        walk(fullPath);
      } else if (entry.isFile()) {
        // Check ignore rules
        if (ig.ignores(relPathForward)) {
          incrementSkip('excluded_file');
          continue;
        }

        // Check if file type is supported
        if (!isSupportedFile(fullPath)) {
          incrementSkip('unsupported_language');
          continue;
        }

        // Check language filter
        const language = detectLanguage(fullPath);
        if (config.languages && config.languages.length > 0) {
          if (!config.languages.includes(language)) {
            incrementSkip('filtered_language');
            continue;
          }
        }

        // Check file size
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          incrementSkip('unreadable_file');
          continue;
        }

        if (stat.size > config.maxFileSize) {
          incrementSkip('file_too_large');
          continue;
        }

        if (stat.size === 0) {
          incrementSkip('empty_file');
          continue;
        }

        files.push({
          absolutePath: fullPath,
          relativePath: relPath,
          language,
          sizeBytes: stat.size,
          lastModified: stat.mtimeMs,
        });
      }
    }
  }

  walk(projectRoot);

  // Build language counts
  const languageCounts: Record<string, number> = {};
  let totalSizeBytes = 0;
  for (const file of files) {
    languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
    totalSizeBytes += file.sizeBytes;
  }

  return {
    files,
    skippedCount,
    skippedReasons,
    totalSizeBytes,
    languageCounts,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Build an ignore filter from configuration and .gitignore files.
 */
function buildIgnoreFilter(config: ExplorerConfig, projectRoot: string): Ignore {
  const ig = ignore();

  // Add configured exclusions
  ig.add(config.exclude);

  // Try to load .gitignore from the project root
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    } catch {
      // Ignore read errors on .gitignore
    }
  }

  return ig;
}
