// apps/frontend/src/pages/dashboard/documents/hooks/use-document-keyboard-shortcuts.ts

import { useEffect } from 'react';

interface UseDocumentKeyboardShortcutsOptions {
  onUpload: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  onSearch: () => void;
}

export function useDocumentKeyboardShortcuts({
  onUpload,
  onNewFolder,
  onRefresh,
  onSearch,
}: UseDocumentKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Ctrl+K even in inputs (common for search)
        if (!((e.metaKey || e.ctrlKey) && e.key === 'k')) {
          return;
        }
      }

      // Cmd/Ctrl + U - Upload
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        onUpload();
      }

      // Cmd/Ctrl + N - New Folder
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        onNewFolder();
      }

      // Cmd/Ctrl + R - Refresh
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        onRefresh();
      }

      // Cmd/Ctrl + K - Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUpload, onNewFolder, onRefresh, onSearch]);
}
