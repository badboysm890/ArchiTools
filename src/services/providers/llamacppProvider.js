import { BaseProvider } from './baseProvider.js';

/**
 * LlamaCpp Provider - Local AI models via LlamaCpp server
 */
export class LlamacppProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.defaultModels = ['qwen3:0.6b', 'qwen-vl:7b', 'gemma3:4b', 'llama3:1b', 'tinyllama:1.1b'];
    this.defaultImageCapableModels = ['gemma3:4b', 'qwen-vl:7b'];
  }

  /**
   * Test connection to LlamaCpp server
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Server responded with status ${response.status}` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Connection failed' 
      };
    }
  }

  /**
   * Get available models from LlamaCpp server
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map(model => model.id);
        }
      }
      
      // Fallback to default models if server request fails
      console.warn('Failed to fetch models from server, using defaults');
      return this.defaultModels;
    } catch (error) {
      console.warn('Failed to fetch models from server, using defaults:', error);
      return this.defaultModels;
    }
  }

  /**
   * Stream chat completion from LlamaCpp server
   */
  async* streamChatCompletion(messages, model, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 2048,
          ...options
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
        
        for (const line of lines) {
          try {
            const jsonStr = line.replace('data: ', '');
            if (jsonStr === '[DONE]') {
              return;
            }
            
            const data = JSON.parse(jsonStr);
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const delta = data.choices[0].delta;
              if (delta.content) {
                yield {
                  content: delta.content,
                  finished: data.choices[0].finish_reason !== null
                };
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse chunk:', line);
          }
        }
      }
    } catch (error) {
      console.error('Failed to stream chat completion:', error);
      throw error;
    }
  }

  /**
   * Non-streaming chat completion
   */
  async getChatCompletion(messages, model, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 2048,
          ...options
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Failed to get chat completion:', error);
      throw error;
    }
  }

  /**
   * Get display name for LlamaCpp models
   */
  getModelDisplayName(modelId) {
    const displayNames = {
      'qwen3:0.6b': 'Qwen 3 (0.6B)',
      'qwen-vl:7b': 'Qwen VL (7B)',
      'gemma3:4b': 'Gemma 3 (4B)',
      'llama3:1b': 'Llama 3 (1B)',
      'tinyllama:1.1b': 'TinyLlama (1.1B)'
    };
    
    return displayNames[modelId] || super.getModelDisplayName(modelId);
  }

  /**
   * Check if model supports images (LlamaCpp specific)
   */
  isImageCapable(modelId) {
    return this.defaultImageCapableModels.includes(modelId);
  }
} 