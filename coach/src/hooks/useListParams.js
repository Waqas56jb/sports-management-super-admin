import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * List state (search, filters, page, sort) stored in the URL so that the back button,
 * refresh and shared links restore exactly what the admin was looking at.
 */
export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const out = { ...defaults };
    searchParams.forEach((value, key) => {
      out[key] = value;
    });
    out.page = Number(out.page) || 1;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const set = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => {
            if (v === undefined || v === null || v === '' || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          });
          if (!('page' in patch)) next.delete('page');
          if (next.get('page') === '1') next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams],
  );

  const reset = useCallback(
    (keys) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          (keys ?? [...prev.keys()]).forEach((k) => next.delete(k));
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { params, set, reset };
}
