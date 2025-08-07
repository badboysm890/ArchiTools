import { BaseProvider } from './baseProvider.js';

/**
 * OpenAI Provider - GPT models via OpenAI API
 */
export class OpenaiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.defaultModels = [
      'gpt-4o',
      'gpt-4o-mini', 
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ];
    this.defaultImageCapableModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo'
    ];
    
    // OpenAI API defaults
    if (!this.baseUrl) {
      this.baseUrl = 'https://api.openai.com';
    }
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        return { success: true };
      } else if (response.status === 401) {
        return { 
          success: false, 
          error: 'Invalid API key' 
        };
      } else {
        return { 
          success: false, 
          error: `API responded with status ${response.status}` 
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
   * Get available models from OpenAI API
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          // Filter to only include GPT models
          const gptModels = data.data
            .filter(model => model.id.includes('gpt'))
            .map(model => model.id)
            .sort();
          
          return gptModels.length > 0 ? gptModels : this.defaultModels;
        }
      }
      
      return this.defaultModels;
    } catch (error) {
      console.warn('Failed to fetch models from OpenAI, using defaults:', error);
      return this.defaultModels;
    }
  }

  /**
   * Stream chat completion from OpenAI API
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
        throw new Error(`OpenAI API error! status: ${response.status}, body: ${errorText}`);
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
      console.error('Failed to stream from OpenAI:', error);
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
        throw new Error(`OpenAI API error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Failed to get completion from OpenAI:', error);
      throw error;
    }
  }

  /**
   * Get display name for OpenAI models
   */
  getModelDisplayName(modelId) {
    const displayNames = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo'
    };
    
    return displayNames[modelId] || super.getModelDisplayName(modelId);
  }

  /**
   * Check if model supports images (OpenAI specific)
   */
  isImageCapable(modelId) {
    return this.defaultImageCapableModels.includes(modelId);
  }
} 