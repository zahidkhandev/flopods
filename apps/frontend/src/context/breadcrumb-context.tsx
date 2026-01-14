// contexts/breadcrumb-context.tsx
import { BreadcrumbContext } from '@/hooks/use-breadcrumbs';
import { useState, useCallback, ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  to: string;
  isLast?: boolean;
}

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [customBreadcrumbs, setCustomBreadcrumbs] = useState<BreadcrumbItem[] | null>(null);

  // Memoize the setter function
  const updateBreadcrumbs = useCallback((breadcrumbs: BreadcrumbItem[] | null) => {
    setCustomBreadcrumbs(breadcrumbs);
  }, []);

  return (
    <BreadcrumbContext.Provider
      value={{ customBreadcrumbs, setCustomBreadcrumbs: updateBreadcrumbs }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
}
