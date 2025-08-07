/**
 * IndexedDB Service - Secure storage for AI provider configurations
 */

class IndexedDBService {
  constructor() {
    this.dbName = 'ArchiToolsDB';
    this.dbVersion = 1;
    this.storeNames = {
      providers: 'ai_providers',
      settings: 'app_settings'
    };
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Initialize IndexedDB
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create providers store
        if (!db.objectStoreNames.contains(this.storeNames.providers)) {
          const providersStore = db.createObjectStore(this.storeNames.providers, { keyPath: 'id' });
          providersStore.createIndex('type', 'type', { unique: false });
          providersStore.createIndex('enabled', 'enabled', { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(this.storeNames.settings)) {
          db.createObjectStore(this.storeNames.settings, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Encrypt sensitive data (API keys)
   */
  encrypt(text) {
    if (!text || text === 'no-key') return text;
    
    // Simple encryption using base64 + reverse + salt
    const salt = 'ArchiTools2024';
    const combined = salt + text + salt;
    const encoded = btoa(combined);
    return 'enc_' + encoded.split('').reverse().join('');
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.startsWith('enc_') || encryptedText === 'no-key') {
      return encryptedText;
    }
    
    try {
      const salt = 'ArchiTools2024';
      const withoutPrefix = encryptedText.substring(4);
      const reversed = withoutPrefix.split('').reverse().join('');
      const decoded = atob(reversed);
      
      // Remove salt from both ends
      if (decoded.startsWith(salt) && decoded.endsWith(salt)) {
        return decoded.substring(salt.length, decoded.length - salt.length);
      }
      
      return encryptedText; // Return as-is if decryption fails
    } catch (error) {
      console.warn('Failed to decrypt text:', error);
      return encryptedText;
    }
  }

  /**
   * Store provider configuration
   */
  async storeProvider(providerConfig) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.providers], 'readwrite');
      const store = transaction.objectStore(this.storeNames.providers);
      
      // Encrypt API key before storing
      const configToStore = {
        ...providerConfig,
        apiKey: this.encrypt(providerConfig.apiKey),
        updatedAt: new Date().toISOString()
      };
      
      const request = store.put(configToStore);
      
      request.onsuccess = () => {
        console.log('Provider stored successfully:', providerConfig.id);
        resolve(configToStore);
      };
      
      request.onerror = () => {
        console.error('Failed to store provider:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get provider configuration by ID
   */
  async getProvider(providerId) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.providers], 'readonly');
      const store = transaction.objectStore(this.storeNames.providers);
      const request = store.get(providerId);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Decrypt API key when retrieving
          const decryptedConfig = {
            ...result,
            apiKey: this.decrypt(result.apiKey)
          };
          resolve(decryptedConfig);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error('Failed to get provider:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all providers
   */
  async getAllProviders() {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.providers], 'readonly');
      const store = transaction.objectStore(this.storeNames.providers);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const providers = request.result.map(provider => ({
          ...provider,
          apiKey: this.decrypt(provider.apiKey)
        }));
        resolve(providers);
      };
      
      request.onerror = () => {
        console.error('Failed to get all providers:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete provider
   */
  async deleteProvider(providerId) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.providers], 'readwrite');
      const store = transaction.objectStore(this.storeNames.providers);
      const request = store.delete(providerId);
      
      request.onsuccess = () => {
        console.log('Provider deleted successfully:', providerId);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error('Failed to delete provider:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Store app setting
   */
  async storeSetting(key, value) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.settings], 'readwrite');
      const store = transaction.objectStore(this.storeNames.settings);
      
      const setting = {
        key,
        value,
        updatedAt: new Date().toISOString()
      };
      
      const request = store.put(setting);
      
      request.onsuccess = () => {
        resolve(setting);
      };
      
      request.onerror = () => {
        console.error('Failed to store setting:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get app setting
   */
  async getSetting(key) {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.settings], 'readonly');
      const store = transaction.objectStore(this.storeNames.settings);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      
      request.onerror = () => {
        console.error('Failed to get setting:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get active provider ID
   */
  async getActiveProviderId() {
    return await this.getSetting('activeProviderId');
  }

  /**
   * Set active provider ID
   */
  async setActiveProviderId(providerId) {
    return await this.storeSetting('activeProviderId', providerId);
  }

  /**
   * Get selected model
   */
  async getSelectedModel() {
    return await this.getSetting('selectedModel');
  }

  /**
   * Set selected model
   */
  async setSelectedModel(model) {
    return await this.storeSetting('selectedModel', model);
  }

  /**
   * Clear all data
   */
  async clearAll() {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeNames.providers, this.storeNames.settings], 'readwrite');
      
      let completed = 0;
      const total = 2;
      
      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve(true);
        }
      };
      
      // Clear providers
      const providersStore = transaction.objectStore(this.storeNames.providers);
      const clearProvidersRequest = providersStore.clear();
      clearProvidersRequest.onsuccess = checkComplete;
      clearProvidersRequest.onerror = () => reject(clearProvidersRequest.error);
      
      // Clear settings
      const settingsStore = transaction.objectStore(this.storeNames.settings);
      const clearSettingsRequest = settingsStore.clear();
      clearSettingsRequest.onsuccess = checkComplete;
      clearSettingsRequest.onerror = () => reject(clearSettingsRequest.error);
    });
  }

  /**
   * Export all data for backup
   */
  async exportData() {
    const providers = await this.getAllProviders();
    const activeProviderId = await this.getActiveProviderId();
    const selectedModel = await this.getSelectedModel();
    
    // Remove sensitive data for export
    const exportProviders = providers.map(provider => ({
      ...provider,
      apiKey: provider.apiKey ? '[REDACTED]' : ''
    }));
    
    return {
      providers: exportProviders,
      activeProviderId,
      selectedModel,
      exportDate: new Date().toISOString(),
      version: this.dbVersion
    };
  }

  /**
   * Import data from backup (without API keys)
   */
  async importData(importData) {
    try {
      // Clear existing data
      await this.clearAll();
      
      // Import providers (user will need to re-enter API keys)
      if (importData.providers) {
        for (const provider of importData.providers) {
          const providerToImport = {
            ...provider,
            apiKey: '', // User needs to re-enter
            updatedAt: new Date().toISOString()
          };
          await this.storeProvider(providerToImport);
        }
      }
      
      // Import settings
      if (importData.activeProviderId) {
        await this.setActiveProviderId(importData.activeProviderId);
      }
      
      if (importData.selectedModel) {
        await this.setSelectedModel(importData.selectedModel);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported() {
    return 'indexedDB' in window;
  }
}

// Create and export singleton instance
const indexedDBService = new IndexedDBService();
export default indexedDBService; 