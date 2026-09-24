import { useSyncExternalStore } from 'react';

export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind `lg` breakpoint — sidebar becomes a drawer below it. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
