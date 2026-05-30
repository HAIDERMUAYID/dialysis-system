import { useEffect, useRef, useState } from 'react';

const ROUTE_ORDER: Record<string, number> = {
  '/dialysis': 0,
  '/dialysis/': 0,
  '/dialysis/patients': 1,
  '/dialysis/sessions': 2,
  '/dialysis/live': 3,
  '/dialysis/reports': 4,
  '/dialysis/pharmacy': 5,
};

function routeIndex(pathname: string): number {
  if (ROUTE_ORDER[pathname] != null) return ROUTE_ORDER[pathname];
  for (const [path, idx] of Object.entries(ROUTE_ORDER)) {
    if (path !== '/dialysis/' && pathname.startsWith(path)) return idx;
  }
  return 99;
}

export type DialysisPageDirection = 'fwd' | 'back';

export function useDialysisPageDirection(pathname: string): DialysisPageDirection {
  const prevRef = useRef(pathname);
  const [dir, setDir] = useState<DialysisPageDirection>('fwd');

  useEffect(() => {
    const prev = routeIndex(prevRef.current);
    const next = routeIndex(pathname);
    setDir(next >= prev ? 'fwd' : 'back');
    prevRef.current = pathname;
  }, [pathname]);

  return dir;
}
