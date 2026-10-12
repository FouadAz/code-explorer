import { useEffect, useRef } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import { ProjectGraph, GraphNode } from '../services/api';

cytoscape.use(coseBilkent);

interface GraphViewProps {
  graph: ProjectGraph;
  onNodeSelect: (node: GraphNode | null) => void;
  selectedNodeId: string | null;
}

export function GraphView({ graph, onNodeSelect, selectedNodeId }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graph.nodes.map(node => ({
          data: {
            id: node.id,
            label: node.name,
            kind: node.kind,
            archRole: node.archRole,
            filePath: node.filePath,
            language: node.language,
            node: node,
          },
        })),
        ...graph.edges.map(edge => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            kind: edge.kind,
            confidence: edge.confidence,
            edge: edge,
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: any) => getNodeColor(ele.data('kind')),
            'label': 'data(label)',
            'color': '#e6edf3',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'width': '30px',
            'height': '30px',
            'border-width': '2px',
            'border-color': '#30363d',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#58a6ff',
            'border-width': '3px',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': (ele: any) => getEdgeColor(ele.data('kind')),
            'target-arrow-color': (ele: any) => getEdgeColor(ele.data('kind')),
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            'opacity': 0.6,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#58a6ff',
            'target-arrow-color': '#58a6ff',
            'opacity': 1,
            'width': 2,
          },
        },
      ],
      layout: {
        name: 'cose-bilkent',
        // @ts-ignore
        idealEdgeLength: 100,
        nodeRepulsion: 8000,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        animate: false,
      },
      minZoom: 0.1,
      maxZoom: 3,
    });

    cyRef.current = cy;

    // Node click handler
    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target.data('node') as GraphNode;
      onNodeSelect(node);
    });

    // Background click handler
    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        onNodeSelect(null);
      }
    });

    return () => {
      cy.destroy();
    };
  }, [graph]);

  // Handle external selection changes
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    cy.$('node').unselect();

    if (selectedNodeId) {
      const node = cy.$(`#${selectedNodeId}`);
      if (node.length > 0) {
        node.select();
        cy.animate({
          fit: {
            eles: node,
            padding: 50
          },
          zoom: 1.5,
        }, {
          duration: 500,
        });
      }
    }
  }, [selectedNodeId]);

  return (
    <div className="graph-container">
      <div id="cy" ref={containerRef} />
      <div className="graph-controls">
        <button
          className="control-btn"
          onClick={() => cyRef.current?.fit(undefined, 50)}
          title="Fit to view"
        >
          ⊡
        </button>
        <button
          className="control-btn"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="control-btn"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
          title="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

function getNodeColor(kind: string): string {
  const colors: Record<string, string> = {
    class: '#3fb950',
    interface: '#58a6ff',
    function: '#d29922',
    enum: '#bc8cff',
    type_alias: '#79c0ff',
    module: '#8b949e',
  };
  return colors[kind] || '#6e7681';
}

function getEdgeColor(kind: string): string {
  const colors: Record<string, string> = {
    imports: '#58a6ff',
    inherits: '#3fb950',
    implements: '#79c0ff',
    calls: '#d29922',
    composes: '#bc8cff',
  };
  return colors[kind] || '#30363d';
}
