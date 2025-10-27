import { createContext, useContext } from 'react';

interface BreadcrumbItem {
  label: string;
  to: string;
  isLast?: boolean;
}

interface BreadcrumbContextType {
  customBreadcrumbs: BreadcrumbItem[] | null;
  setCustomBreadcrumbs: (breadcrumbs: BreadcrumbItem[] | null) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumbs must be used within BreadcrumbProvider');
  }
  return context;
}
