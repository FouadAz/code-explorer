#!/usr/bin/env node
/**
 * Download pre-built tree-sitter WASM grammars
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const WASM_DIR = path.join(__dirname, '..', 'wasm');
const GRAMMARS = [
  {
    name: 'tree-sitter-java',
    version: '0.21.0',
    url: 'https://github.com/tree-sitter/tree-sitter-java/releases/download/v0.21.0/tree-sitter-java.wasm',
    output: 'tree-sitter-java.wasm'
  },
  {
    name: 'tree-sitter-javascript',
    version: '0.21.2',
    url: 'https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.21.2/tree-sitter-javascript.wasm',
    output: 'tree-sitter-javascript.wasm'
  },
  {
    name: 'tree-sitter-typescript',
    version: '0.21.2',
    url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.21.2/tree-sitter-typescript.wasm',
    output: 'tree-sitter-typescript.wasm'
  },
  {
    name: 'tree-sitter-python',
    version: '0.21.0',
    url: 'https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.21.0/tree-sitter-python.wasm',
    output: 'tree-sitter-python.wasm'
  }
];

// Ensure WASM directory exists
if (!fs.existsSync(WASM_DIR)) {
  fs.mkdirSync(WASM_DIR, { recursive: true });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(outputPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`  ✓ Saved to: ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function downloadAll() {
  console.log('📦 Downloading tree-sitter WASM grammars...\n');

  for (const grammar of GRAMMARS) {
    const outputPath = path.join(WASM_DIR, grammar.output);

    if (fs.existsSync(outputPath)) {
      console.log(`⏭  Skipping ${grammar.name} (already exists)`);
      continue;
    }

    try {
      await downloadFile(grammar.url, outputPath);
    } catch (err) {
      console.error(`❌ Failed to download ${grammar.name}:`, err.message);
      console.error(`   Please download manually from: ${grammar.url}`);
    }
  }

  console.log('\n✅ Grammar download complete!\n');
}

downloadAll().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
