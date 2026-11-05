import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

import { errorMessage } from "../api/client";

interface LoaderState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Load data when `deps` change. `reload(true)` refreshes in the background without
 * clearing what is on screen; stale responses from earlier calls are ignored.
 */
export function useLoader<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<LoaderState<T>>({ data: null, error: null, loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;
  const latest = useRef(0);

  const reload = useCallback(async (silent = false) => {
    const call = ++latest.current;
    if (!silent) setState({ data: null, error: null, loading: true });
    try {
      const data = await loadRef.current();
      if (call === latest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (call === latest.current) setState((s) => ({ ...s, error: errorMessage(error), loading: false }));
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((update: (prev: T | null) => T | null) => {
    setState((s) => ({ ...s, data: update(s.data) }));
  }, []);

  return { ...state, reload, setData };
}
