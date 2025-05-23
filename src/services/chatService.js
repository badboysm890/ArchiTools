/**
 * Chat Service - Handles chat operations and API communication
 */

import imageContextService from './imageContextService.js';

class ChatService {
  constructor() {
    this.baseUrl = 'http://localhost:8091';
    this._messageCounter = 0;
    
    // Image-capable models
    this.imageCapableModels = ['gemma3:4b', 'qwen-vl:7b'];
  }

  /**
   * Get available models from the server
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          'Authorization': 'Bearer no-key'
        }
      });
      const data = await response.json();
      
      if (data.data) {
        return data.data.map(model => model.id);
      }
      
      return [];
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
   * Stream chat completion from llama.cpp server
   */
  async* streamChatCompletion(messages, model = 'qwen-vl:7b') {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer no-key'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
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
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert canvas to base64 (legacy method for direct conversion)
   */
  canvasToBase64(canvas) {
    // Get canvas data as base64, removing the data URL prefix
    return canvas.toDataURL('image/png').split(',')[1];
  }

  /**
   * Create message content based on input type with smart image handling
   */
  async createMessageContent(text, images = [], sessionId = 'default') {
    if (!images || images.length === 0) {
      return text;
    }

    // Use image context service to process images intelligently
    const { imagesToSend, imageReferences } = await imageContextService.processImagesForMessage(images, sessionId);

    // Create content array for llama.cpp format
    const content = [];

    // Add image references as text context if any
    let textContent = text || 'Describe this image.';
    if (imageReferences.length > 0) {
      const referenceText = imageContextService.createImageReferenceText(imageReferences);
      textContent = `${referenceText}\n\n${textContent}`;
    }

    // Process only new images that need to be sent
    for (const image of imagesToSend) {
      // Check if this is a multi-page PDF result
      if (image && typeof image === 'object' && image.multiplePages) {
        console.log(`Processing multi-page PDF: ${image.metadata.capturedPages} pages`);
        
        // Add each page as a separate image
        for (const [index, page] of image.pages.entries()) {
          const imageFormat = page.metadata?.format || 'png';
          
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:image/${imageFormat};base64,${page.base64}`
            }
          });
          
          console.log(`Added PDF page ${page.metadata.pageNumber}/${page.metadata.totalPages}: ${page.metadata.sizeKB.toFixed(1)}KB`);
        }
        
        // Update text content to mention PDF pages
        if (image.metadata.capturedPages > 1) {
          textContent = `[PDF Document: ${image.metadata.fileName} - ${image.metadata.capturedPages} pages captured]\n\n${textContent}`;
        } else {
          textContent = `[PDF Document: ${image.metadata.fileName} - 1 page captured]\n\n${textContent}`;
        }
        
        continue;
      }

      let base64Data;
      let imageFormat = 'png';
      
      if (typeof image === 'string') {
        // Already base64 or data URL
        if (image.startsWith('data:')) {
          base64Data = image.split(',')[1];
          // Extract format from data URL
          const formatMatch = image.match(/data:image\/([^;]+)/);
          if (formatMatch) {
            imageFormat = formatMatch[1];
          }
        } else {
          base64Data = image;
        }
      } else if (image instanceof File) {
        // Convert file to base64
        base64Data = await this.fileToBase64(image);
        // Try to get format from file type
        if (image.type.startsWith('image/')) {
          imageFormat = image.type.split('/')[1];
        }
      } else if (image instanceof HTMLCanvasElement) {
        // Convert canvas to base64 (legacy method)
        base64Data = this.canvasToBase64(image);
      } else if (image && typeof image === 'object' && image.base64) {
        // Enhanced canvas capture result with metadata
        base64Data = image.base64;
        if (image.metadata && image.metadata.format) {
          imageFormat = image.metadata.format;
        }
        
        // Log compression info if available
        if (image.metadata) {
          console.log('Using processed image:', {
            size: `${image.metadata.width}x${image.metadata.height}`,
            fileSize: `${image.metadata.sizeKB.toFixed(1)}KB`,
            format: image.metadata.format,
            quality: image.metadata.quality,
            originalSize: `${image.metadata.originalWidth}x${image.metadata.originalHeight}`,
            captureMode: image.metadata.captureMode
          });
          
          // Add capture mode info to text if it's a whole file capture
          if (image.metadata.captureMode === 'whole' && image.metadata.fileName) {
            textContent = `[Whole file capture: ${image.metadata.fileName}]\n\n${textContent}`;
          }
        }
      } else if (image && typeof image === 'object' && image.url) {
        // Handle cases where we return a URL (for unsupported file types in whole mode)
        console.log('Image object contains URL, skipping image processing:', image.url);
        continue;
      } else {
        throw new Error('Invalid image format');
      }

      // Add image to content array
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/${imageFormat};base64,${base64Data}`
        }
      });
    }

    // Add text content at the end
    content.push({
      type: 'text',
      text: textContent
    });

    return content;
  }

  /**
   * Non-streaming chat completion (for compatibility)
   */
  async getChatCompletion(messages, model = 'qwen-vl:7b') {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer no-key'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          temperature: 0.7,
          max_tokens: 2048
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
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
   * Create a message object with smart image context tracking
   */
  createMessage(role, content, images = [], sessionId = 'default') {
    // Create a more robust unique ID using timestamp + random + counter
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const counter = (this._messageCounter = (this._messageCounter || 0) + 1).toString(36);
    
    const message = {
      role,
      content,
      images,
      timestamp: Date.now(),
      id: `${timestamp}-${random}-${counter}`,
      sessionId
    };

    // Add image context info for debugging (non-production)
    if (process.env.NODE_ENV === 'development' && images && images.length > 0) {
      message._imageDebugInfo = {
        imageCount: images.length,
        sessionId
      };
    }

    return message;
  }

  /**
   * Format messages for API (convert to llama.cpp format) with smart image handling
   * Only keeps the latest image in history to prevent server issues with multiple images
   */
  async formatMessagesForAPI(messages, sessionId = 'default') {
    const formattedMessages = [];
    
    // Find the index of the last message that contains images
    let lastImageMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].images && messages[i].images.length > 0) {
        lastImageMessageIndex = i;
        break;
      }
    }
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Only include images for the latest message with images
      // Remove image data from all previous messages to prevent server conflicts
      const imagesToUse = (i === lastImageMessageIndex) ? message.images : [];
      
      const content = await this.createMessageContent(
        typeof message.content === 'string' ? message.content : message.content[0]?.text || '',
        imagesToUse,
        sessionId
      );
      
      formattedMessages.push({
        role: message.role,
        content: content
      });
      
      // Log when we're skipping images from previous messages
      if (message.images && message.images.length > 0 && i !== lastImageMessageIndex) {
        console.log(`Removed ${message.images.length} image(s) from message ${i + 1} to prevent server conflicts`);
      }
    }
    
    if (lastImageMessageIndex >= 0) {
      console.log(`Keeping images only from message ${lastImageMessageIndex + 1} (latest with images)`);
    }
    
    return formattedMessages;
  }

  /**
   * Clear image context for a session
   */
  clearImageContext(sessionId = 'default') {
    imageContextService.clearSession(sessionId);
  }

  /**
   * Get image context statistics
   */
  getImageContextStats(sessionId = 'default') {
    return {
      global: imageContextService.getStats(),
      session: imageContextService.getSessionStats(sessionId)
    };
  }
}

// Create and export singleton instance
const chatService = new ChatService();
export default chatService; 