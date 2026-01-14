// hooks/use-set-breadcrumbs.ts
import { useEffect, useMemo } from 'react';
import { useBreadcrumbs } from './use-breadcrumbs';

interface BreadcrumbItem {
  label: string;
  to: string;
  isLast?: boolean;
}

export function useSetBreadcrumbs(breadcrumbs: BreadcrumbItem[] | null) {
  const { setCustomBreadcrumbs } = useBreadcrumbs();

  // Memoize breadcrumbs to prevent unnecessary re-renders
  const memoizedBreadcrumbs = useMemo(() => {
    return breadcrumbs ? JSON.stringify(breadcrumbs) : null;
  }, [breadcrumbs]);

  useEffect(() => {
    if (memoizedBreadcrumbs) {
      setCustomBreadcrumbs(JSON.parse(memoizedBreadcrumbs));
    } else {
      setCustomBreadcrumbs(null);
    }

    return () => {
      setCustomBreadcrumbs(null);
    };
    // Only depend on stringified version
  }, [memoizedBreadcrumbs, setCustomBreadcrumbs]);
}
