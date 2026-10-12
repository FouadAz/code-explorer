#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('code-explorer')
  .description('Local-first codebase intelligence tool — visualize architecture, dependencies, and execution flow')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a project and generate the architecture graph')
  .option('-c, --config <path>', 'Path to configuration file', 'code-explorer.config.json')
  .option('--clear-cache', 'Clear analysis cache before starting')
  .action(async (options) => {
    try {
      const { analyzeCommand } = await import('./analyze');
      await analyzeCommand(options);
    } catch (err) {
      console.error(chalk.red('Error:'), (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the local web server to explore the graph')
  .option('-c, --config <path>', 'Path to configuration file', 'code-explorer.config.json')
  .option('-p, --port <number>', 'Server port', '3000')
  .option('--no-open', 'Do not automatically open browser')
  .action(async (options) => {
    try {
      const { serveCommand } = await import('./serve');
      await serveCommand(options);
    } catch (err) {
      console.error(chalk.red('Error:'), (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('open')
  .description('Open the dashboard (runs analyze + serve if needed)')
  .option('-c, --config <path>', 'Path to configuration file', 'code-explorer.config.json')
  .option('-p, --port <number>', 'Server port', '3000')
  .action(async (options) => {
    try {
      const { openCommand } = await import('./open');
      await openCommand(options);
    } catch (err) {
      console.error(chalk.red('Error:'), (err as Error).message);
      process.exit(1);
    }
  });

program.parse();
