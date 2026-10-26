// Runs an async loader and tracks data/loading/error. Call `reload()` to fetch again.

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => void;
}

export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const requestId = useRef(0); // ignore responses from outdated requests

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    run()
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (id === requestId.current) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [run]);

  useEffect(reload, [reload]);

  return { data, loading, error, reload };
}
