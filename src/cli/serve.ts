import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { loadConfig } from '../config/loader';
import { startServer } from '../server/app';

interface ServeOptions {
  config: string;
  port: string;
  open: boolean;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  console.log(chalk.bold.cyan('\n🌐 Code Explorer - Starting Server\n'));

  // Load configuration
  const config = loadConfig(options.config);
  const port = parseInt(options.port, 10);

  // Check if analysis results exist
  const graphPath = path.join(config.outputDir, 'graph.json');
  if (!fs.existsSync(graphPath)) {
    console.log(chalk.yellow('⚠ No analysis results found.'));
    console.log(chalk.gray(`Run ${chalk.cyan('code-explorer analyze')} first to generate the graph.\n`));
    process.exit(1);
  }

  // Start server
  const url = await startServer(config, port, options.open);

  console.log(chalk.bold.green('\n✓ Server running!'));
  console.log(chalk.gray(`  Local:  ${chalk.cyan(url)}`));
  console.log(chalk.gray(`\nPress ${chalk.cyan('Ctrl+C')} to stop.\n`));

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down server...'));
    process.exit(0);
  });
}
