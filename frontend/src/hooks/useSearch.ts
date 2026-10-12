import { useState, useCallback } from 'react';
import { api, SearchResult } from '../services/api';

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await api.search(q);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  return { results, searching, query, search };
}
