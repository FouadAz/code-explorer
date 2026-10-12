import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { FileAnalysis } from '../types';

/**
 * Cache for parsed file analysis results.
 * Uses file content hash as the key to detect changes.
 */
export class AstCache {
  private cacheDir: string;
  private memoryCache = new Map<string, FileAnalysis>();

  constructor(outputDir: string) {
    this.cacheDir = path.join(outputDir, 'cache');
    this.ensureCacheDir();
  }

  /**
   * Get cached analysis for a file if available and still valid.
   */
  get(filePath: string, contentHash: string): FileAnalysis | null {
    // Check memory cache first
    const cacheKey = this.getCacheKey(filePath, contentHash);
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // Check disk cache
    const cachePath = this.getCachePath(contentHash);
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as FileAnalysis;
        this.memoryCache.set(cacheKey, cached);
        return cached;
      } catch {
        // Invalid cache file, ignore
        return null;
      }
    }

    return null;
  }

  /**
   * Store analysis result in cache.
   */
  set(filePath: string, contentHash: string, analysis: FileAnalysis): void {
    const cacheKey = this.getCacheKey(filePath, contentHash);
    this.memoryCache.set(cacheKey, analysis);

    // Write to disk cache
    const cachePath = this.getCachePath(contentHash);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(analysis, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`Failed to write cache file: ${(err as Error).message}`);
    }
  }

  /**
   * Compute hash of file contents for cache key.
   */
  static hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 12);
  }

  private getCacheKey(filePath: string, contentHash: string): string {
    return `${filePath}:${contentHash}`;
  }

  private getCachePath(contentHash: string): string {
    return path.join(this.cacheDir, `${contentHash}.json`);
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.memoryCache.clear();
    if (fs.existsSync(this.cacheDir)) {
      for (const file of fs.readdirSync(this.cacheDir)) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    }
  }
}
