/**
 * Provider Service - Manages all AI providers and provides unified interface
 */
import { LlamacppProvider } from './providers/llamacppProvider.js';
import { OpenaiProvider } from './providers/openaiProvider.js';
import indexedDBService from './indexedDBService.js';

class ProviderService {
  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
  }

  /**
   * Initialize the provider service
   */
  async initialize() {
    try {
      await indexedDBService.initialize();
      await this.loadFromStorage();
      
      // If no providers loaded, create default LlamaCpp provider
      if (this.providers.size === 0) {
        await this.createDefaultProvider();
      }
      
      // Set active provider if none set
      if (!this.activeProvider && this.providers.size > 0) {
        const firstProvider = Array.from(this.providers.values())[0];
        this.activeProvider = firstProvider;
      }
    } catch (error) {
      console.error('Failed to initialize provider service:', error);
      // Fallback to creating default provider
      if (this.providers.size === 0) {
        await this.createDefaultProvider();
      }
    }
  }

  /**
   * Create default LlamaCpp provider
   */
  async createDefaultProvider() {
    const defaultConfig = {
      id: 'llamacpp',
      name: 'LlamaCpp (Local)',
      type: 'llamacpp',
      baseUrl: 'http://localhost:8091',
      apiKey: 'no-key',
      enabled: true,
      description: 'Local AI models via LlamaCpp'
    };
    
    await this.addProvider(defaultConfig);
  }

  /**
   * Add a new provider
   */
  async addProvider(config) {
    let provider;
    
    switch (config.type) {
      case 'llamacpp':
        provider = new LlamacppProvider(config);
        break;
      case 'openai':
        provider = new OpenaiProvider(config);
        break;
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
    
    this.providers.set(config.id, provider);
    
    // Set as active if it's the first provider
    if (!this.activeProvider) {
      this.activeProvider = provider;
      await indexedDBService.setActiveProviderId(config.id);
    }
    
    // Save to IndexedDB
    await indexedDBService.storeProvider(config);
    return provider;
  }

  /**
   * Update a provider
   */
  async updateProvider(id, updates) {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }
    
    const updatedConfig = { ...provider.config, ...updates };
    provider.updateConfig(updates);
    
    // Save to IndexedDB
    await indexedDBService.storeProvider(updatedConfig);
    return provider;
  }

  /**
   * Remove a provider
   */
  async removeProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }
    
    this.providers.delete(id);
    
    // If removing active provider, switch to first available
    if (this.activeProvider && this.activeProvider.id === id) {
      const remainingProviders = Array.from(this.providers.values());
      this.activeProvider = remainingProviders.length > 0 ? remainingProviders[0] : null;
      
      if (this.activeProvider) {
        await indexedDBService.setActiveProviderId(this.activeProvider.id);
      }
    }
    
    // Remove from IndexedDB
    await indexedDBService.deleteProvider(id);
    return true;
  }

  /**
   * Set active provider
   */
  async setActiveProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }
    
    this.activeProvider = provider;
    await indexedDBService.setActiveProviderId(id);
    return provider;
  }

  /**
   * Get active provider
   */
  getActiveProvider() {
    return this.activeProvider;
  }

  /**
   * Get all providers
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders() {
    return Array.from(this.providers.values()).filter(p => p.config.enabled);
  }

  /**
   * Test a provider connection
   */
  async testProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }
    
    return await provider.testConnection();
  }

  /**
   * Get models from active provider
   */
  async getModels() {
    if (!this.activeProvider) {
      throw new Error('No active provider');
    }
    
    return await this.activeProvider.getModels();
  }

  /**
   * Stream chat completion using active provider
   */
  async* streamChatCompletion(messages, model, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No active provider');
    }
    
    yield* this.activeProvider.streamChatCompletion(messages, model, options);
  }

  /**
   * Get chat completion using active provider
   */
  async getChatCompletion(messages, model, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No active provider');
    }
    
    return await this.activeProvider.getChatCompletion(messages, model, options);
  }

  /**
   * Check if model supports images
   */
  isImageCapable(modelId) {
    if (!this.activeProvider) {
      return false;
    }
    
    return this.activeProvider.isImageCapable(modelId);
  }

  /**
   * Get model display name
   */
  getModelDisplayName(modelId) {
    if (!this.activeProvider) {
      return modelId;
    }
    
    return this.activeProvider.getModelDisplayName(modelId);
  }

  /**
   * Load providers from IndexedDB
   */
  async loadFromStorage() {
    try {
      const storedProviders = await indexedDBService.getAllProviders();
      const activeProviderId = await indexedDBService.getActiveProviderId();
      
      // Recreate providers
      for (const config of storedProviders) {
        try {
          let provider;
          
          switch (config.type) {
            case 'llamacpp':
              provider = new LlamacppProvider(config);
              break;
            case 'openai':
              provider = new OpenaiProvider(config);
              break;
            default:
              console.warn(`Unknown provider type: ${config.type}`);
              continue;
          }
          
          this.providers.set(config.id, provider);
        } catch (error) {
          console.warn(`Failed to load provider ${config.id}:`, error);
        }
      }
      
      // Set active provider
      if (activeProviderId) {
        const activeProvider = this.providers.get(activeProviderId);
        if (activeProvider) {
          this.activeProvider = activeProvider;
        }
      }
    } catch (error) {
      console.error('Failed to load providers from storage:', error);
    }
  }

  /**
   * Export provider configurations (for backup)
   */
  async exportConfig() {
    return await indexedDBService.exportData();
  }

  /**
   * Import provider configurations (for restore)
   */
  async importConfig(config) {
    try {
      // Clear existing providers in memory
      this.providers.clear();
      this.activeProvider = null;
      
      // Import to IndexedDB
      await indexedDBService.importData(config);
      
      // Reload from storage
      await this.loadFromStorage();
      
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }
}

// Create and export singleton instance
const providerService = new ProviderService();
export default providerService; 