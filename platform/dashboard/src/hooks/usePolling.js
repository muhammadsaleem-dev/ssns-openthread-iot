/**
 * usePolling — custom hook for periodic data fetching.
 *
 * Fetches data on mount and re-fetches at a configurable interval.
 * Provides loading, error, and data state to consuming components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export default function usePolling(fetchFn, interval = 10000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [fetchFn]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const id = setInterval(load, interval);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [load, interval]);

  return { data, loading, error, refetch: load };
}
