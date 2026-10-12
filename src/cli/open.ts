import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { loadConfig } from '../config/loader';
import { analyzeCommand } from './analyze';
import { serveCommand } from './serve';

interface OpenOptions {
  config: string;
  port: string;
}

export async function openCommand(options: OpenOptions): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 Code Explorer - Quick Start\n'));

  // Load configuration
  const config = loadConfig(options.config);

  // Check if analysis results exist
  const graphPath = path.join(config.outputDir, 'graph.json');
  const needsAnalysis = !fs.existsSync(graphPath);

  if (needsAnalysis) {
    console.log(chalk.gray('No analysis found, running analysis first...\n'));
    await analyzeCommand({ config: options.config });
  } else {
    console.log(chalk.green('✓ Analysis results found, starting server...\n'));
  }

  // Start server
  await serveCommand({ config: options.config, port: options.port, open: true });
}
