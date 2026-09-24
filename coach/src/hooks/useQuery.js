import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Data fetching with loading/error state. Keeps the previous data while refetching so tables
 * don't flash back to skeletons when filters change (`fetching` is true in that case).
 */
export function useQuery(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled, fetching: enabled });
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: s.data === undefined, fetching: true, error: null }));
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) setState({ data, error: null, loading: false, fetching: false });
      return data;
    } catch (error) {
      if (id === requestId.current) setState((s) => ({ ...s, error, loading: false, fetching: false }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, refetch: run, setData };
}
