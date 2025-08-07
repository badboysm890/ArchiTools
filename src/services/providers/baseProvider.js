/**
 * Base Provider Class - Abstract interface for AI providers
 */
export class BaseProvider {
  constructor(config) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.models = config.models || [];
    this.imageCapableModels = config.imageCapableModels || [];
  }

  /**
   * Test the provider connection
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async testConnection() {
    throw new Error('testConnection must be implemented by provider');
  }

  /**
   * Get available models from the provider
   * @returns {Promise<string[]>}
   */
  async getModels() {
    throw new Error('getModels must be implemented by provider');
  }

  /**
   * Stream chat completion
   * @param {Array} messages - Chat messages
   * @param {string} model - Model ID
   * @param {Object} options - Additional options
   * @returns {AsyncGenerator}
   */
  async* streamChatCompletion(messages, model, options = {}) {
    throw new Error('streamChatCompletion must be implemented by provider');
  }

  /**
   * Non-streaming chat completion
   * @param {Array} messages - Chat messages  
   * @param {string} model - Model ID
   * @param {Object} options - Additional options
   * @returns {Promise<string>}
   */
  async getChatCompletion(messages, model, options = {}) {
    throw new Error('getChatCompletion must be implemented by provider');
  }

  /**
   * Check if a model supports images
   * @param {string} modelId - Model ID
   * @returns {boolean}
   */
  isImageCapable(modelId) {
    return this.imageCapableModels.includes(modelId);
  }

  /**
   * Get display name for a model
   * @param {string} modelId - Model ID
   * @returns {string}
   */
  getModelDisplayName(modelId) {
    // Default implementation - override in specific providers for custom names
    return modelId.replace(/[:_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Update provider configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    Object.assign(this, newConfig);
  }
} 