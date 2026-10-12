# Code Explorer

**Local-first codebase intelligence tool** — visualize architecture, dependencies, and execution flow

A developer tool that analyzes software projects and generates an interactive visual representation of their architecture. Built with TypeScript, Tree-sitter, and Cytoscape.js.

## Features

✅ **Local-first** — runs entirely on your machine, no cloud services required  
✅ **Multi-language support** — TypeScript, JavaScript, Python, Java (extensible to more)  
✅ **Automatic analysis** — discovers classes, interfaces, functions, imports, and relationships  
✅ **Interactive visualization** — explore your codebase as an interactive graph  
✅ **Smart search** — find any class, function, or file instantly  
✅ **Relationship tracking** — see inheritance, composition, imports, and method calls  
✅ **Zero configuration** — works out of the box with sensible defaults  
✅ **No LLM required** — pure static analysis, optional AI features disabled by default

## Installation

```bash
cd code-explorer
npm install
npm run build
```

Optionally link it globally:
```bash
npm link
```

## Quick Start

1. **Create a configuration file** in your project or in the code-explorer directory:

```json
{
  "projectPath": "../your-project"
}
```

2. **Analyze your project**:

```bash
code-explorer analyze --config code-explorer.config.json
```

3. **Start the visualization server**:

```bash
code-explorer serve
```

4. **Or do both at once**:

```bash
code-explorer open
```

Then open your browser to `http://localhost:3000`

## Configuration

Create a `code-explorer.config.json` file:

```json
{
  "projectPath": "../my-application",
  "exclude": ["node_modules", ".git", "dist", "build"],
  "include": ["src", "lib"],
  "languages": ["typescript", "javascript"],
  "maxFileSize": 1048576,
  "maxFiles": 10000,
  "outputDir": ".explorer"
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectPath` | string | **required** | Path to the project to analyze |
| `exclude` | string[] | `["node_modules", ".git", ...]` | Patterns to exclude |
| `include` | string[] | `undefined` | If set, only scan these directories |
| `languages` | string[] | `undefined` | Filter by language (auto-detected if omitted) |
| `maxFileSize` | number | `1048576` (1MB) | Skip files larger than this |
| `maxFiles` | number | `10000` | Maximum files to analyze |
| `outputDir` | string | `.explorer` | Where to write analysis results |

## How It Works

### 1. Static Analysis

The tool uses **Tree-sitter** to parse source files into Abstract Syntax Trees (ASTs), then extracts:

- Classes, interfaces, enums, type aliases
- Functions and methods
- Properties and fields
- Imports and exports
- Inheritance and interface implementation
- Decorators and annotations
- Type references

### 2. Cross-File Resolution

The resolver builds a symbol table and resolves:

- Import paths to their source files
- Symbol references across files
- Type references
- Call relationships (where detectable)

### 3. Graph Construction

Nodes represent code entities (classes, functions, etc.)  
Edges represent relationships (imports, inheritance, calls, etc.)

Each relationship includes:
- **Confidence level** (definite, high, medium, inferred)
- **Evidence** (how it was discovered)
- **Source location** (file and line number)

### 4. Interactive Visualization

The frontend uses **Cytoscape.js** with force-directed layouts to render an interactive graph where you can:

- Zoom, pan, and explore
- Search for any node
- Click nodes to see details
- See methods, properties, and relationships
- Filter by language, type, or architectural role

## Supported Languages

| Language | Status | Features |
|----------|--------|----------|
| TypeScript | ✅ Full | Classes, interfaces, types, decorators, generics |
| JavaScript | ✅ Full | Classes, functions, CommonJS/ES modules |
| Python | 🟡 Good | Classes, functions, imports, decorators |
| Java | 🟡 Good | Classes, interfaces, annotations, inheritance |
| C#, Go, Rust | 🔜 Planned | Coming soon |

## Architecture

```
code-explorer/
├── src/
│   ├── cli/           # Command-line interface
│   ├── config/        # Configuration loading
│   ├── scanner/       # File discovery
│   ├── parser/        # Tree-sitter integration
│   ├── extractors/    # Language-specific AST visitors
│   ├── resolver/      # Cross-file reference resolution
│   ├── graph/         # Graph construction
│   └── server/        # Express API server
├── frontend/
│   └── src/
│       ├── components/  # React components
│       ├── hooks/       # React hooks
│       └── services/    # API client
└── test/
    └── fixtures/      # Sample projects for testing
```

## Commands

### `code-explorer analyze`

Analyze a project and generate the graph.

```bash
code-explorer analyze --config <path>
code-explorer analyze --config <path> --clear-cache
```

Options:
- `--config, -c` — Path to config file (default: `code-explorer.config.json`)
- `--clear-cache` — Clear the analysis cache before starting

### `code-explorer serve`

Start the local web server to explore the graph.

```bash
code-explorer serve --config <path> --port 3000
code-explorer serve --no-open
```

Options:
- `--config, -c` — Path to config file
- `--port, -p` — Server port (default: `3000`)
- `--no-open` — Don't automatically open browser

### `code-explorer open`

Convenience command that runs analyze + serve.

```bash
code-explorer open
```

## Output Structure

After analysis, the `.explorer/` directory contains:

```
.explorer/
├── meta.json          # Project metadata
├── graph.json         # Complete graph (nodes + edges)
├── symbols.json       # Symbol index for search
├── files.json         # File index
└── cache/             # Per-file parse cache
    └── <hash>.json
```

## Performance

Typical performance on a modern laptop:

| Project Size | Files | Analysis Time | Graph Size |
|--------------|-------|---------------|------------|
| Small | 50 files | ~2 seconds | < 1 MB |
| Medium | 500 files | ~15 seconds | ~10 MB |
| Large | 2000 files | ~60 seconds | ~50 MB |

The tool uses incremental caching, so re-analyzing after small changes is fast.

## Limitations

This tool performs **static analysis only**. It cannot detect:

- Runtime-generated code or dynamic imports
- Reflection-based instantiation
- Event bus subscribers registered at runtime
- Actual execution paths (it shows possible paths)

Relationships are labeled with confidence levels:
- **Definite** — directly observable in source (e.g., `extends`)
- **High** — strong evidence (e.g., typed field)
- **Medium** — inferred from patterns
- **Inferred** — educated guess

## Extending with New Languages

To add support for a new language:

1. Install the Tree-sitter grammar: `npm install tree-sitter-<language>`
2. Add the language to `src/config/schema.ts`
3. Create a new extractor in `src/extractors/<language>.ts`
4. Register it in `src/analyzer/analysisEngine.ts`

See `src/extractors/typescript.ts` for a reference implementation.

## Development

```bash
# Install dependencies
npm install

# Build backend
npm run build

# Run in dev mode
npm run dev

# Build frontend
cd frontend
npm install
npm run build

# Run tests
npm test
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for developers exploring unfamiliar codebases.
