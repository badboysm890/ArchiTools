/**
 * Storage Service - Handles secure storage of sensitive provider data
 */

class StorageService {
  constructor() {
    this.storageKey = 'ai-providers-secure';
    this.apiKeyPrefix = 'ai_key_';
  }

  /**
   * Simple encryption for API keys (basic obfuscation)
   * Note: This is NOT cryptographically secure, just basic obfuscation
   * For production, use proper encryption libraries
   */
  obfuscate(text) {
    if (!text) return '';
    // Simple base64 encoding with a basic offset
    const encoded = btoa(text);
    return encoded.split('').reverse().join('');
  }

  /**
   * Deobfuscate text
   */
  deobfuscate(text) {
    if (!text) return '';
    try {
      const decoded = text.split('').reverse().join('');
      return atob(decoded);
    } catch (error) {
      console.warn('Failed to deobfuscate text:', error);
      return '';
    }
  }

  /**
   * Store provider configuration with sensitive data handling
   */
  storeProviderConfig(providerId, config) {
    try {
      const configToStore = { ...config };
      
      // Obfuscate API key if present
      if (configToStore.apiKey && configToStore.apiKey !== 'no-key') {
        const obfuscatedKey = this.obfuscate(configToStore.apiKey);
        configToStore.apiKey = `${this.apiKeyPrefix}${obfuscatedKey}`;
      }
      
      // Get existing configs
      const existingConfigs = this.getAllProviderConfigs();
      existingConfigs[providerId] = configToStore;
      
      // Store updated configs
      localStorage.setItem(this.storageKey, JSON.stringify(existingConfigs));
      return true;
    } catch (error) {
      console.error('Failed to store provider config:', error);
      return false;
    }
  }

  /**
   * Get provider configuration with sensitive data decryption
   */
  getProviderConfig(providerId) {
    try {
      const allConfigs = this.getAllProviderConfigs();
      const config = allConfigs[providerId];
      
      if (!config) return null;
      
      // Deobfuscate API key if it was obfuscated
      const configToReturn = { ...config };
      if (configToReturn.apiKey && configToReturn.apiKey.startsWith(this.apiKeyPrefix)) {
        const obfuscatedKey = configToReturn.apiKey.substring(this.apiKeyPrefix.length);
        configToReturn.apiKey = this.deobfuscate(obfuscatedKey);
      }
      
      return configToReturn;
    } catch (error) {
      console.error('Failed to get provider config:', error);
      return null;
    }
  }

  /**
   * Get all provider configurations
   */
  getAllProviderConfigs() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get provider configs:', error);
      return {};
    }
  }

  /**
   * Remove provider configuration
   */
  removeProviderConfig(providerId) {
    try {
      const existingConfigs = this.getAllProviderConfigs();
      delete existingConfigs[providerId];
      localStorage.setItem(this.storageKey, JSON.stringify(existingConfigs));
      return true;
    } catch (error) {
      console.error('Failed to remove provider config:', error);
      return false;
    }
  }

  /**
   * Get all stored provider configurations with sensitive data decrypted
   */
  getAllProviderConfigsDecrypted() {
    const allConfigs = this.getAllProviderConfigs();
    const decryptedConfigs = {};
    
    for (const [providerId, config] of Object.entries(allConfigs)) {
      decryptedConfigs[providerId] = this.getProviderConfig(providerId);
    }
    
    return decryptedConfigs;
  }

  /**
   * Store active provider ID
   */
  storeActiveProviderId(providerId) {
    try {
      localStorage.setItem('ai-providers-active', providerId);
      return true;
    } catch (error) {
      console.error('Failed to store active provider ID:', error);
      return false;
    }
  }

  /**
   * Get active provider ID
   */
  getActiveProviderId() {
    try {
      return localStorage.getItem('ai-providers-active');
    } catch (error) {
      console.error('Failed to get active provider ID:', error);
      return null;
    }
  }

  /**
   * Clear all stored provider data
   */
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem('ai-providers-active');
      return true;
    } catch (error) {
      console.error('Failed to clear provider data:', error);
      return false;
    }
  }

  /**
   * Export provider configurations (for backup)
   * Note: API keys will be excluded for security
   */
  exportConfigs() {
    const allConfigs = this.getAllProviderConfigs();
    const exportData = {};
    
    for (const [providerId, config] of Object.entries(allConfigs)) {
      exportData[providerId] = {
        ...config,
        apiKey: config.apiKey ? '[REDACTED]' : ''
      };
    }
    
    return {
      providers: exportData,
      activeProviderId: this.getActiveProviderId(),
      exportDate: new Date().toISOString()
    };
  }

  /**
   * Import provider configurations (without API keys)
   * User will need to re-enter API keys after import
   */
  importConfigs(importData) {
    try {
      if (!importData.providers) {
        throw new Error('Invalid import data format');
      }
      
      // Clear existing data
      this.clearAll();
      
      // Import provider configs (without API keys)
      for (const [providerId, config] of Object.entries(importData.providers)) {
        const configToImport = {
          ...config,
          apiKey: '' // User needs to re-enter API keys
        };
        this.storeProviderConfig(providerId, configToImport);
      }
      
      // Import active provider ID
      if (importData.activeProviderId) {
        this.storeActiveProviderId(importData.activeProviderId);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import configs:', error);
      return false;
    }
  }
}

// Create and export singleton instance
const storageService = new StorageService();
export default storageService; 