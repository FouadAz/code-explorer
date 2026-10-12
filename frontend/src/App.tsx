import { useState } from 'react';
import { useGraph } from './hooks/useGraph';
import { GraphView } from './components/GraphView';
import { SearchBar } from './components/SearchBar';
import { DetailPanel } from './components/DetailPanel';
import { GraphNode } from './services/api';
import './styles/index.css';

function App() {
  const { graph, loading, error } = useGraph();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleNodeSelect = (node: GraphNode | null) => {
    setSelectedNode(node);
    setSelectedNodeId(node?.id || null);
  };

  const handleSearchResultClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = graph?.nodes.find(n => n.id === nodeId) || null;
    setSelectedNode(node);
  };

  if (loading) {
    return (
      <div className="loading">
        <div>Loading project graph...</div>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="error">
        <div className="error-title">Failed to Load Graph</div>
        <div className="error-message">{error || 'Unknown error'}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          <span>🗺️</span>
          <span>Code Explorer</span>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span>Files:</span>
            <span className="stat-value">{graph.metadata.totalFiles}</span>
          </div>
          <div className="stat">
            <span>Nodes:</span>
            <span className="stat-value">{graph.metadata.totalNodes}</span>
          </div>
          <div className="stat">
            <span>Edges:</span>
            <span className="stat-value">{graph.metadata.totalEdges}</span>
          </div>
          <div className="stat">
            <span>Languages:</span>
            <span className="stat-value">
              {Object.keys(graph.metadata.languages).join(', ')}
            </span>
          </div>
        </div>
      </header>

      <div className="main-content">
        <SearchBar onResultClick={handleSearchResultClick} />
        <GraphView
          graph={graph}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNodeId}
        />
        <DetailPanel node={selectedNode} />
      </div>
    </div>
  );
}

export default App;
