import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/**
 * هوك بسيط لجلب البيانات مع إعادة التحميل وإدارة حالات التحميل والأخطاء.
 */
export function useApi(
  path,
  { params, enabled = true, initialData = null, deps = [], silent = false } = {}
) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(enabled) && !silent);
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const key = JSON.stringify(params ?? null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!enabled) return null;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const result = await api.get(path, paramsRef.current);
        if (mounted.current) setData(result);
        return result;
      } catch (err) {
        if (err.name !== "AbortError" && mounted.current) setError(err);
        return null;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, key, enabled]
  );

  useEffect(() => {
    load({ quiet: silent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { data, loading, error, refetch: load, setData };
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
