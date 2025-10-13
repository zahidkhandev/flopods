import { ThemeProviderContext } from '@/components/shared/theme/theme-provider';
import { useContext } from 'react';

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
}
