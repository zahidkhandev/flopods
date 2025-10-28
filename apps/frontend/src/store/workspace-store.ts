// src/store/workspace-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

interface WorkspaceState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string) => void;
  clearWorkspace: () => void;
}

const encodeWorkspaceId = (id: string): string => {
  return btoa(id);
};

const decodeWorkspaceId = (encoded: string): string => {
  try {
    return atob(encoded);
  } catch {
    return '';
  }
};

const customStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const str = localStorage.getItem(name);
    if (!str) return null;

    try {
      const parsed = JSON.parse(str);
      if (parsed.state?.currentWorkspaceId) {
        parsed.state.currentWorkspaceId = decodeWorkspaceId(parsed.state.currentWorkspaceId);
      }
      return JSON.stringify(parsed);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed.state?.currentWorkspaceId) {
        parsed.state.currentWorkspaceId = encodeWorkspaceId(parsed.state.currentWorkspaceId);
      }
      localStorage.setItem(name, JSON.stringify(parsed));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id: string) => {
        console.log('📌 Workspace set to:', id);
        set({ currentWorkspaceId: id });
      },
      clearWorkspace: () => set({ currentWorkspaceId: null }),
    }),
    {
      name: 'flopods-workspace',
      storage: createJSONStorage(() => customStorage),
    }
  )
);
