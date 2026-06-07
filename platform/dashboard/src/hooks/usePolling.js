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
  const load = useCallback(async (isMounted) => {
    try {
      const result = await fetchFn();
      if (isMounted()) {
        setData(result);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (isMounted()) {
        setError(err);
        setLoading(false);
      }
    }
  }, [fetchFn]);

  useEffect(() => {
    let isCurrent = true;
    const isMounted = () => isCurrent;
    
    load(isMounted);
    
    let id;
    if (interval !== null) {
      id = setInterval(() => load(isMounted), interval);
    }
    return () => {
      isCurrent = false;
      if (id) clearInterval(id);
    };
  }, [load, interval]);

  return { data, loading, error, refetch: () => load(() => true) };
}
