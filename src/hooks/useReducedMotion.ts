import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
  const [matches, setMatch] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMatch(mediaQuery.matches);
    
    const handler = (event: MediaQueryListEvent) => setMatch(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return matches;
}
