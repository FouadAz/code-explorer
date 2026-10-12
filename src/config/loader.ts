import * as fs from 'fs';
import * as path from 'path';
import { ExplorerConfig } from '../types';
import { DEFAULT_CONFIG, ConfigError, VALID_LANGUAGES } from './schema';

/**
 * Load and validate the explorer configuration file.
 */
export function loadConfig(configPath: string): ExplorerConfig {
  const absoluteConfigPath = path.resolve(configPath);

  if (!fs.existsSync(absoluteConfigPath)) {
    throw new ConfigError(
      `Configuration file not found: ${absoluteConfigPath}\n` +
      `Create a code-explorer.config.json with at least:\n` +
      `  { "projectPath": "./path/to/your/project" }`,
    );
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(absoluteConfigPath, 'utf-8');
  } catch (err) {
    throw new ConfigError(`Cannot read configuration file: ${(err as Error).message}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new ConfigError(
      `Invalid JSON in configuration file: ${(err as Error).message}\n` +
      `Check for trailing commas, missing quotes, or other syntax errors.`,
    );
  }

  return validateConfig(parsed, absoluteConfigPath);
}

/**
 * Validate parsed config and merge with defaults.
 */
function validateConfig(
  raw: Record<string, unknown>,
  configFilePath: string,
): ExplorerConfig {
  // projectPath is required
  if (!raw.projectPath || typeof raw.projectPath !== 'string') {
    throw new ConfigError(
      'Missing or invalid "projectPath" in configuration.\n' +
      'This must be a string path to the project you want to analyze.\n' +
      'Example: { "projectPath": "../my-application" }',
      'projectPath',
    );
  }

  // Resolve projectPath relative to the config file's directory
  const configDir = path.dirname(configFilePath);
  const projectPath = path.resolve(configDir, raw.projectPath as string);

  if (!fs.existsSync(projectPath)) {
    throw new ConfigError(
      `Project path does not exist: ${projectPath}\n` +
      `Resolved from: "${raw.projectPath}" relative to ${configDir}`,
      'projectPath',
    );
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    throw new ConfigError(
      `Project path is not a directory: ${projectPath}`,
      'projectPath',
    );
  }

  // Build config with defaults
  const config: ExplorerConfig = {
    projectPath,
    exclude: mergeArrayField(raw.exclude, DEFAULT_CONFIG.exclude, 'exclude'),
    maxFileSize: mergeNumberField(raw.maxFileSize, DEFAULT_CONFIG.maxFileSize, 'maxFileSize', 1024, 100_000_000),
    maxFiles: mergeNumberField(raw.maxFiles, DEFAULT_CONFIG.maxFiles, 'maxFiles', 1, 1_000_000),
    outputDir: path.resolve(configDir, (raw.outputDir as string) || DEFAULT_CONFIG.outputDir),
  };

  // Optional: include directories
  if (raw.include !== undefined) {
    if (!Array.isArray(raw.include) || !raw.include.every((s: unknown) => typeof s === 'string')) {
      throw new ConfigError('"include" must be an array of strings', 'include');
    }
    config.include = raw.include as string[];
  }

  // Optional: languages filter
  if (raw.languages !== undefined) {
    if (!Array.isArray(raw.languages)) {
      throw new ConfigError('"languages" must be an array of language identifiers', 'languages');
    }
    for (const lang of raw.languages) {
      if (!VALID_LANGUAGES.includes(lang as any)) {
        throw new ConfigError(
          `Unknown language: "${lang}". Supported: ${VALID_LANGUAGES.join(', ')}`,
          'languages',
        );
      }
    }
    config.languages = raw.languages as any[];
  }

  // Optional: entry points
  if (raw.entryPoints !== undefined) {
    if (!Array.isArray(raw.entryPoints) || !raw.entryPoints.every((s: unknown) => typeof s === 'string')) {
      throw new ConfigError('"entryPoints" must be an array of file paths', 'entryPoints');
    }
    config.entryPoints = raw.entryPoints as string[];
  }

  // Optional: AI config
  if (raw.ai !== undefined) {
    const ai = raw.ai as Record<string, unknown>;
    config.ai = {
      enabled: ai.enabled === true,
      provider: ai.provider as string | undefined,
      model: ai.model as string | undefined,
      apiKey: resolveEnvVar(ai.apiKey as string | undefined),
    };
  }

  return config;
}

function mergeArrayField(
  value: unknown,
  defaultValue: string[],
  fieldName: string,
): string[] {
  if (value === undefined) return [...defaultValue];
  if (!Array.isArray(value) || !value.every((s: unknown) => typeof s === 'string')) {
    throw new ConfigError(`"${fieldName}" must be an array of strings`, fieldName);
  }
  return value as string[];
}

function mergeNumberField(
  value: unknown,
  defaultValue: number,
  fieldName: string,
  min: number,
  max: number,
): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ConfigError(`"${fieldName}" must be a number`, fieldName);
  }
  if (value < min || value > max) {
    throw new ConfigError(
      `"${fieldName}" must be between ${min} and ${max} (got ${value})`,
      fieldName,
    );
  }
  return value;
}

/** Resolve ${ENV_VAR} references in strings */
function resolveEnvVar(value?: string): string | undefined {
  if (!value) return value;
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}
