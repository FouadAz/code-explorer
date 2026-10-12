import { useState, useEffect } from 'react';
import { api, ProjectGraph } from '../services/api';

export function useGraph() {
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGraph();
  }, []);

  async function loadGraph() {
    try {
      setLoading(true);
      const data = await api.fetchGraph();
      setGraph(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return { graph, loading, error, reload: loadGraph };
}
