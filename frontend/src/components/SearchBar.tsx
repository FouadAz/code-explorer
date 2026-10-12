import React, { useState } from 'react';
import { useSearch } from '../hooks/useSearch';

interface SearchBarProps {
  onResultClick: (nodeId: string) => void;
}

export function SearchBar({ onResultClick }: SearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const { results, searching, search } = useSearch();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    search(value);
  };

  const handleResultClick = (nodeId: string) => {
    onResultClick(nodeId);
    setInputValue('');
  };

  return (
    <div className="sidebar">
      <div className="search-box">
        <input
          type="text"
          className="search-input"
          placeholder="Search classes, functions, files..."
          value={inputValue}
          onChange={handleInputChange}
        />
      </div>

      <div className="search-results">
        {searching && <div style={{ padding: '12px', color: '#8b949e' }}>Searching...</div>}

        {!searching && results.length === 0 && inputValue.length >= 2 && (
          <div style={{ padding: '12px', color: '#8b949e' }}>No results found</div>
        )}

        {!searching && results.length === 0 && inputValue.length < 2 && (
          <div style={{ padding: '12px', color: '#8b949e' }}>
            Type to search nodes...
          </div>
        )}

        {!searching && results.map((result) => (
          <div
            key={result.nodeId}
            className="search-result-item"
            onClick={() => handleResultClick(result.nodeId)}
          >
            <div className="result-name">{result.name}</div>
            <div className="result-meta">
              <span className="result-kind">{result.kind}</span>
              <span>{result.filePath}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
