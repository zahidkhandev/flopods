// File: apps/frontend/src/pages/dashboard/flows/[id]/context/models-context.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { axiosInstance } from '@/lib/axios-instance';

interface Model {
  modelId: string;
  modelName: string;
  provider: string;
  inputTokenCost: string;
  outputTokenCost: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsStreaming: boolean;
}

interface ModelsByProvider {
  provider: string;
  models: Model[];
  count: number;
}

interface ModelsContextValue {
  providers: string[];
  modelsByProvider: ModelsByProvider[];
  getModelsForProvider: (provider: string) => Model[];
  isLoading: boolean;
}

const ModelsContext = createContext<ModelsContextValue | null>(null);

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [modelsByProvider, setModelsByProvider] = useState<ModelsByProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axiosInstance.get('/models/grouped');
        setModelsByProvider(response.data.data || response.data);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const providers = modelsByProvider.map((p) => p.provider);

  const getModelsForProvider = (provider: string) => {
    return modelsByProvider.find((p) => p.provider === provider)?.models || [];
  };

  const value = {
    providers,
    modelsByProvider,
    getModelsForProvider,
    isLoading,
  };

  return <ModelsContext.Provider value={value}>{children}</ModelsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModels() {
  const context = useContext(ModelsContext);
  if (!context) {
    throw new Error('useModels must be used within ModelsProvider');
  }
  return context;
}
