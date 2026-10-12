import { GraphNode } from '../services/api';

interface DetailPanelProps {
  node: GraphNode | null;
}

export function DetailPanel({ node }: DetailPanelProps) {
  if (!node) {
    return (
      <div className="detail-panel">
        <div className="detail-header">
          <div className="detail-title">No Selection</div>
          <div className="detail-subtitle">Click a node to view details</div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-title">{node.name}</div>
        <div className="detail-subtitle">
          <span className="result-kind">{node.kind}</span>
          {' • '}
          <span>{node.language}</span>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <div className="section-title">Information</div>
          <div className="info-row">
            <span className="info-label">File</span>
            <span className="info-value">{node.filePath}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Lines</span>
            <span className="info-value">{node.lineStart}-{node.lineEnd}</span>
          </div>
          <div className="info-row">
            <span className="info-label">LOC</span>
            <span className="info-value">{node.linesOfCode}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Role</span>
            <span className="info-value">{node.archRole}</span>
          </div>
          {node.packageName && (
            <div className="info-row">
              <span className="info-label">Package</span>
              <span className="info-value">{node.packageName}</span>
            </div>
          )}
        </div>

        {node.decorators && node.decorators.length > 0 && (
          <div className="detail-section">
            <div className="section-title">Decorators</div>
            <ul className="method-list">
              {node.decorators.map((dec, i) => (
                <li key={i} className="method-item">@{dec}</li>
              ))}
            </ul>
          </div>
        )}

        {node.properties && node.properties.length > 0 && (
          <div className="detail-section">
            <div className="section-title">Properties ({node.properties.length})</div>
            <ul className="property-list">
              {node.properties.slice(0, 10).map((prop, i) => (
                <li key={i} className="property-item">
                  {prop.visibility} {prop.name}{prop.type ? `: ${prop.type}` : ''}
                </li>
              ))}
              {node.properties.length > 10 && (
                <li className="property-item" style={{ opacity: 0.6 }}>
                  ... and {node.properties.length - 10} more
                </li>
              )}
            </ul>
          </div>
        )}

        {node.methods && node.methods.length > 0 && (
          <div className="detail-section">
            <div className="section-title">Methods ({node.methods.length})</div>
            <ul className="method-list">
              {node.methods.slice(0, 10).map((method, i) => (
                <li key={i} className="method-item">
                  {method.visibility} {method.name}(
                  {method.parameters.map(p => p.name).join(', ')}
                  ){method.returnType ? `: ${method.returnType}` : ''}
                </li>
              ))}
              {node.methods.length > 10 && (
                <li className="method-item" style={{ opacity: 0.6 }}>
                  ... and {node.methods.length - 10} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
