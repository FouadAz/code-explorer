import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../config/loader';
import { scanProject } from '../scanner/fileScanner';
import { AnalysisEngine } from '../analyzer/analysisEngine';
import { ImportResolver } from '../resolver/importResolver';
import { JavaImportResolver } from '../resolver/javaImportResolver';
import { GraphBuilder } from '../graph/graphBuilder';

interface AnalyzeOptions {
  config: string;
  clearCache?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  console.log(chalk.bold.cyan('\n🔍 Code Explorer - Project Analysis\n'));

  // Load configuration
  const spinner = ora('Loading configuration...').start();
  let config;
  try {
    config = loadConfig(options.config);
    spinner.succeed(`Configuration loaded from ${chalk.cyan(options.config)}`);
  } catch (err) {
    spinner.fail('Failed to load configuration');
    throw err;
  }

  // Initialize analysis engine
  spinner.start('Initializing analysis engine...');
  const engine = new AnalysisEngine(config);

  if (options.clearCache) {
    engine.clearCache();
    spinner.text = 'Cache cleared, initializing...';
  }

  try {
    await engine.initialize();
    spinner.succeed('Analysis engine initialized');
  } catch (err) {
    spinner.fail('Failed to initialize analysis engine');
    throw err;
  }

  // Scan project
  spinner.start(`Scanning project: ${chalk.cyan(config.projectPath)}`);
  const scanResult = scanProject(config);
  spinner.succeed(
    `Found ${chalk.green(scanResult.files.length)} source files ` +
    `(${formatBytes(scanResult.totalSizeBytes)}, skipped ${scanResult.skippedCount})`,
  );

  // Show language breakdown
  console.log(chalk.gray('  Languages:'));
  for (const [lang, count] of Object.entries(scanResult.languageCounts)) {
    console.log(chalk.gray(`    ${lang}: ${count} files`));
  }

  if (scanResult.files.length === 0) {
    console.log(chalk.yellow('\n⚠ No source files found. Check your configuration.'));
    return;
  }

  // Analyze files
  spinner.start('Parsing and extracting structure...');
  const startTime = Date.now();
  let lastUpdate = Date.now();

  const analyses = await engine.analyzeFiles(
    scanResult.files,
    (current, total, file) => {
      const now = Date.now();
      if (now - lastUpdate > 100) {
        spinner.text = `Analyzing files... ${current}/${total} (${file})`;
        lastUpdate = now;
      }
    },
  );

  const analysisTime = Date.now() - startTime;
  spinner.succeed(`Analyzed ${chalk.green(analyses.length)} files in ${chalk.cyan(analysisTime + 'ms')}`);

  // Count extracted nodes
  const totalNodes = analyses.reduce((sum, a) => sum + a.nodes.length, 0);
  console.log(chalk.gray(`  Extracted ${totalNodes} nodes (classes, interfaces, functions, etc.)`));

  // Resolve cross-file references
  spinner.start('Resolving cross-file references...');

  // Detect primary language
  const languageCounts = scanResult.languageCounts;
  const isJavaProject = languageCounts.java && languageCounts.java > (languageCounts.typescript || 0);

  let edges;
  if (isJavaProject) {
    const javaResolver = new JavaImportResolver();
    edges = javaResolver.resolve(analyses);
  } else {
    const resolver = new ImportResolver();
    edges = resolver.resolve(analyses);
  }

  spinner.succeed(`Resolved ${chalk.green(edges.length)} relationships`);

  // Build graph
  spinner.start('Building project graph...');
  const builder = new GraphBuilder();
  const graph = builder.build(analyses, edges, config, scanResult.durationMs + analysisTime);
  spinner.succeed('Project graph constructed');

  // Calculate metrics
  spinner.start('Calculating graph metrics...');
  const metrics = builder.calculateMetrics(graph);
  spinner.succeed('Metrics calculated');

  // Write output
  spinner.start(`Writing results to ${chalk.cyan(config.outputDir)}`);
  builder.writeGraph(graph, config.outputDir);
  spinner.succeed('Analysis complete!');

  // Summary
  console.log(chalk.bold.green('\n✓ Analysis Summary:'));
  console.log(chalk.gray(`  Files analyzed: ${analyses.length}`));
  console.log(chalk.gray(`  Nodes extracted: ${graph.nodes.length}`));
  console.log(chalk.gray(`  Relationships found: ${graph.edges.length}`));
  console.log(chalk.gray(`  Output directory: ${config.outputDir}`));
  console.log(chalk.cyan(`\nRun ${chalk.bold('code-explorer serve')} to explore the results.\n`));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
