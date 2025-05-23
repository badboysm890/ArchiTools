import OpenAI from 'openai';

class ChatService {
  constructor() {
    this.baseUrl = 'http://localhost:8091';
    this.imageCapableModels = [
      'gemma3:4b',
      'qwen-vl:7b'
    ];
    
    // Initialize OpenAI client for llama.cpp server
    this.client = new OpenAI({
      baseURL: `${this.baseUrl}/v1`,
      apiKey: 'no-key', // llama.cpp doesn't require real API key
      dangerouslyAllowBrowser: true // Allow browser usage
    });
  }

  /**
   * Get available models from the server
   */
  async getModels() {
    try {
      const response = await this.client.models.list();
      const models = response.data.map(model => model.id);
      return models.length > 0 ? models : [
        'qwen3:0.6b',
        'qwen-vl:7b', 
        'gemma3:4b',
        'llama3:1b',
        'tinyllama:1.1b'
      ];
    } catch (error) {
      console.warn('Failed to fetch models from server, using defaults:', error);
      return [
        'qwen3:0.6b',
        'qwen-vl:7b',
        'gemma3:4b', 
        'llama3:1b',
        'tinyllama:1.1b'
      ];
    }
  }

  /**
   * Check if a model supports images
   */
  isImageCapable(modelId) {
    return this.imageCapableModels.includes(modelId);
  }

  /**
   * Convert file to base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert canvas to base64
   */
  canvasToBase64(canvas) {
    // Get canvas data as base64, removing the data URL prefix
    return canvas.toDataURL('image/png').split(',')[1];
  }

  /**
   * Create message content based on input type
   */
  async createMessageContent(text, images = []) {
    if (!images || images.length === 0) {
      return text;
    }

    // For images, create OpenAI-compatible content format
    const content = [
      {
        type: 'text',
        text: text || 'Describe this image.'
      }
    ];

    for (const image of images) {
      let base64Data;
      if (typeof image === 'string') {
        // Already base64 or data URL
        if (image.startsWith('data:')) {
          base64Data = image.split(',')[1];
        } else {
          base64Data = image;
        }
      } else if (image instanceof File) {
        // Convert file to base64
        base64Data = await this.fileToBase64(image);
      } else if (image instanceof HTMLCanvasElement) {
        // Convert canvas to base64
        base64Data = this.canvasToBase64(image);
      } else {
        throw new Error('Invalid image format');
      }

      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64Data}`
        }
      });
    }

    return content;
  }

  /**
   * Send chat completion request with streaming using OpenAI client
   */
  async *streamChatCompletion(messages, modelId = 'gemma3:4b', options = {}) {
    try {
      const stream = await this.client.chat.completions.create({
        model: modelId,
        messages: messages,
        stream: true,
        ...options
      });

      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
          const delta = chunk.choices[0].delta;
          if (delta.content) {
            yield {
              content: delta.content,
              finished: chunk.choices[0].finish_reason !== null,
              chunk: chunk
            };
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      throw error;
    }
  }

  /**
   * Send a simple non-streaming request using OpenAI client
   */
  async sendChatCompletion(messages, modelId = 'gemma3:4b', options = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: modelId,
        messages: messages,
        stream: false,
        ...options
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Chat completion error:', error);
      throw error;
    }
  }

  /**
   * Create a message object
   */
  createMessage(role, content, images = []) {
    // Create a more robust unique ID using timestamp + random + counter
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const counter = (this._messageCounter = (this._messageCounter || 0) + 1).toString(36);
    
    return {
      role,
      content,
      images,
      timestamp: Date.now(),
      id: `${timestamp}-${random}-${counter}`
    };
  }

  /**
   * Format messages for API (convert to OpenAI format)
   */
  async formatMessagesForAPI(messages) {
    const formattedMessages = [];
    
    for (const message of messages) {
      const content = await this.createMessageContent(
        typeof message.content === 'string' ? message.content : message.content[0]?.text || '',
        message.images
      );
      
      formattedMessages.push({
        role: message.role,
        content: content
      });
    }
    
    return formattedMessages;
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService; 