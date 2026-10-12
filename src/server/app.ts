import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { ExplorerConfig, ProjectGraph, GraphNode, SearchResult } from '../types';

/**
 * Start the Express server.
 */
export async function startServer(
  config: ExplorerConfig,
  port: number,
  openBrowser: boolean,
): Promise<string> {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  setupApiRoutes(app, config);

  // Serve frontend static files
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));

    // SPA fallback
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    // Development mode: show placeholder
    app.get('*', (req: Request, res: Response) => {
      res.send(`
        <html>
          <head>
            <title>Code Explorer</title>
            <style>
              body { font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #0066cc; }
              pre { background: #f5f5f5; padding: 20px; border-radius: 8px; overflow-x: auto; }
              code { color: #cc0066; }
            </style>
          </head>
          <body>
            <h1>🚀 Code Explorer Server Running</h1>
            <p>The backend is running, but the frontend hasn't been built yet.</p>
            <h2>Build the frontend:</h2>
            <pre><code>cd frontend
npm install
npm run build
cd ..
npm run serve</code></pre>
            <h2>API Endpoints:</h2>
            <ul>
              <li><a href="/api/graph">GET /api/graph</a> - Full project graph</li>
              <li><a href="/api/meta">GET /api/meta</a> - Project metadata</li>
              <li><a href="/api/symbols">GET /api/symbols</a> - Symbol index</li>
              <li>GET /api/node/:id - Node details</li>
              <li>GET /api/search?q=... - Search nodes</li>
            </ul>
          </body>
        </html>
      `);
    });
  }

  // Start listening
  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      resolve();
    });
  });

  const url = `http://localhost:${port}`;

  // Open browser if requested
  if (openBrowser) {
    const { default: open } = await import('open');
    await open(url);
  }

  return url;
}

/**
 * Setup API routes.
 */
function setupApiRoutes(app: Express, config: ExplorerConfig): void {
  const outputDir = config.outputDir;

  // GET /api/graph - Full graph
  app.get('/api/graph', (req: Request, res: Response) => {
    try {
      const graphPath = path.join(outputDir, 'graph.json');
      const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
      res.json(graph);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load graph', message: (err as Error).message });
    }
  });

  // GET /api/meta - Project metadata
  app.get('/api/meta', (req: Request, res: Response) => {
    try {
      const metaPath = path.join(outputDir, 'meta.json');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      res.json(meta);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load metadata', message: (err as Error).message });
    }
  });

  // GET /api/symbols - Symbol index
  app.get('/api/symbols', (req: Request, res: Response) => {
    try {
      const symbolsPath = path.join(outputDir, 'symbols.json');
      const symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf-8'));
      res.json(symbols);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load symbols', message: (err as Error).message });
    }
  });

  // GET /api/files - Files index
  app.get('/api/files', (req: Request, res: Response) => {
    try {
      const filesPath = path.join(outputDir, 'files.json');
      const files = JSON.parse(fs.readFileSync(filesPath, 'utf-8'));
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load files', message: (err as Error).message });
    }
  });

  // GET /api/node/:id - Node details
  app.get('/api/node/:id', (req: Request, res: Response) => {
    try {
      const graphPath = path.join(outputDir, 'graph.json');
      const graph: ProjectGraph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
      const node = graph.nodes.find(n => n.id === req.params.id);

      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }

      // Include connected edges
      const connectedEdges = graph.edges.filter(
        e => e.source === node.id || e.target === node.id,
      );

      res.json({ node, edges: connectedEdges });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load node', message: (err as Error).message });
    }
  });

  // GET /api/search?q=query - Search nodes
  app.get('/api/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string || '').toLowerCase();
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const symbolsPath = path.join(outputDir, 'symbols.json');
      const symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf-8'));

      const results: SearchResult[] = [];

      for (const symbol of symbols) {
        const nameLower = symbol.name.toLowerCase();
        const fileLower = symbol.filePath.toLowerCase();

        if (nameLower.includes(query)) {
          results.push({
            nodeId: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            filePath: symbol.filePath,
            score: nameLower === query ? 100 : (query.length / nameLower.length) * 80,
            matchField: 'name',
          });
        } else if (fileLower.includes(query)) {
          results.push({
            nodeId: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            filePath: symbol.filePath,
            score: 50,
            matchField: 'file',
          });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      res.json(results.slice(0, 50)); // Limit to top 50 results
    } catch (err) {
      res.status(500).json({ error: 'Search failed', message: (err as Error).message });
    }
  });

  // GET /api/impact/:nodeId - Impact analysis (upstream/downstream dependencies)
  app.get('/api/impact/:nodeId', (req: Request, res: Response) => {
    try {
      const graphPath = path.join(outputDir, 'graph.json');
      const graph: ProjectGraph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
      const nodeId = req.params.nodeId;

      // Find upstream (what this depends on)
      const upstream = new Set<string>();
      const downstream = new Set<string>();

      function traverseUpstream(id: string, depth: number = 0): void {
        if (depth > 5) return; // Limit depth
        const edges = graph.edges.filter(e => e.source === id);
        for (const edge of edges) {
          if (!upstream.has(edge.target)) {
            upstream.add(edge.target);
            traverseUpstream(edge.target, depth + 1);
          }
        }
      }

      function traverseDownstream(id: string, depth: number = 0): void {
        if (depth > 5) return; // Limit depth
        const edges = graph.edges.filter(e => e.target === id);
        for (const edge of edges) {
          if (!downstream.has(edge.source)) {
            downstream.add(edge.source);
            traverseDownstream(edge.source, depth + 1);
          }
        }
      }

      traverseUpstream(nodeId);
      traverseDownstream(nodeId);

      res.json({
        nodeId,
        upstream: Array.from(upstream),
        downstream: Array.from(downstream),
      });
    } catch (err) {
      res.status(500).json({ error: 'Impact analysis failed', message: (err as Error).message });
    }
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}
