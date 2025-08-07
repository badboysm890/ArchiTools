import { createSlice } from '@reduxjs/toolkit';

// Default providers configuration
const defaultProviders = [
  {
    id: 'llamacpp',
    name: 'LlamaCpp (Local)',
    type: 'llamacpp',
    baseUrl: 'http://localhost:8091',
    apiKey: 'no-key',
    isDefault: true,
    enabled: true,
    models: ['qwen3:0.6b', 'qwen-vl:7b', 'gemma3:4b', 'llama3:1b', 'tinyllama:1.1b'],
    imageCapableModels: ['gemma3:4b', 'qwen-vl:7b'],
    description: 'Local AI models via LlamaCpp'
  }
];

const initialState = {
  providers: defaultProviders,
  activeProviderId: 'llamacpp',
  selectedModel: 'qwen-vl:7b',
  loading: false,
  error: null,
  showSettings: false
};

const providersSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    addProvider: (state, action) => {
      const newProvider = {
        ...action.payload,
        id: action.payload.id || `provider-${Date.now()}`,
        enabled: true
      };
      state.providers.push(newProvider);
    },
    
    updateProvider: (state, action) => {
      const { id, ...updates } = action.payload;
      const index = state.providers.findIndex(p => p.id === id);
      if (index !== -1) {
        state.providers[index] = { ...state.providers[index], ...updates };
      }
    },
    
    removeProvider: (state, action) => {
      const id = action.payload;
      state.providers = state.providers.filter(p => p.id !== id);
      
      // If removing active provider, switch to first available
      if (state.activeProviderId === id) {
        const firstProvider = state.providers.find(p => p.enabled);
        state.activeProviderId = firstProvider?.id || null;
      }
    },
    
    setActiveProvider: (state, action) => {
      const providerId = action.payload;
      const provider = state.providers.find(p => p.id === providerId && p.enabled);
      if (provider) {
        state.activeProviderId = providerId;
        // Reset model selection when switching providers
        const firstModel = provider.models?.[0];
        if (firstModel) {
          state.selectedModel = firstModel;
        }
      }
    },
    
    setSelectedModel: (state, action) => {
      state.selectedModel = action.payload;
    },
    
    setProviderModels: (state, action) => {
      const { providerId, models } = action.payload;
      const provider = state.providers.find(p => p.id === providerId);
      if (provider) {
        provider.models = models;
      }
    },
    
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    
    setError: (state, action) => {
      state.error = action.payload;
    },
    
    setShowSettings: (state, action) => {
      state.showSettings = action.payload;
    },
    
    toggleProvider: (state, action) => {
      const id = action.payload;
      const provider = state.providers.find(p => p.id === id);
      if (provider) {
        provider.enabled = !provider.enabled;
        
        // If disabling active provider, switch to first enabled
        if (!provider.enabled && state.activeProviderId === id) {
          const firstEnabled = state.providers.find(p => p.enabled);
          state.activeProviderId = firstEnabled?.id || null;
        }
      }
    },
    
    // Load providers from storage
    loadProviders: (state, action) => {
      if (action.payload && action.payload.length > 0) {
        state.providers = action.payload;
        // Ensure we have an active provider
        const activeExists = state.providers.find(p => p.id === state.activeProviderId && p.enabled);
        if (!activeExists) {
          const firstEnabled = state.providers.find(p => p.enabled);
          state.activeProviderId = firstEnabled?.id || null;
        }
      }
    }
  }
});

// Selectors
export const selectActiveProvider = (state) => {
  return state.providers.providers.find(p => p.id === state.providers.activeProviderId);
};

export const selectAvailableModels = (state) => {
  const activeProvider = selectActiveProvider(state);
  return activeProvider?.models || [];
};

export const selectImageCapableModels = (state) => {
  const activeProvider = selectActiveProvider(state);
  return activeProvider?.imageCapableModels || [];
};

export const selectEnabledProviders = (state) => {
  return state.providers.providers.filter(p => p.enabled);
};

export const {
  addProvider,
  updateProvider,
  removeProvider,
  setActiveProvider,
  setSelectedModel,
  setProviderModels,
  setLoading,
  setError,
  setShowSettings,
  toggleProvider,
  loadProviders
} = providersSlice.actions;

export default providersSlice.reducer; 