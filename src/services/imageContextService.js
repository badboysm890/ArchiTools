/**
 * Image Context Service - Manages image context and references in chat history
 * Prevents sending the same image to LLM multiple times
 */

class ImageContextService {
  constructor() {
    // Map of image hashes to their processed data and context
    this.imageCache = new Map();
    
    // Map of chat session to used images
    this.sessionImageHistory = new Map();
    
    // Counter for generating unique reference IDs
    this.referenceCounter = 0;
  }

  /**
   * Simple hash function for browser compatibility
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate a hash for an image to identify duplicates
   */
  generateImageHash(imageData) {
    let hashInput = '';
    
    if (typeof imageData === 'string') {
      // Base64 string or data URL
      hashInput = imageData.startsWith('data:') ? imageData.split(',')[1] : imageData;
    } else if (imageData && typeof imageData === 'object' && imageData.base64) {
      // Processed image object
      hashInput = imageData.base64;
    } else if (imageData instanceof HTMLCanvasElement) {
      // Canvas element
      hashInput = imageData.toDataURL().split(',')[1];
    } else {
      throw new Error('Unsupported image format for hashing');
    }
    
    // Take a sample from the middle of the base64 string to avoid identical headers/footers
    const sampleSize = Math.min(1000, hashInput.length);
    const startPos = Math.floor((hashInput.length - sampleSize) / 2);
    const sample = hashInput.substring(startPos, startPos + sampleSize);
    
    return this.simpleHash(sample);
  }

  /**
   * Generate a unique reference ID for an image
   */
  generateReferenceId() {
    return `img_ref_${++this.referenceCounter}_${Date.now()}`;
  }

  /**
   * Process images for a chat message, returning new images and references
   */
  async processImagesForMessage(images = [], sessionId = 'default') {
    if (!images || images.length === 0) {
      return { imagesToSend: [], imageReferences: [] };
    }

    const imagesToSend = [];
    const imageReferences = [];
    const sessionHistory = this.sessionImageHistory.get(sessionId) || new Set();

    for (const image of images) {
      try {
        const imageHash = this.generateImageHash(image);
        const existingImage = this.imageCache.get(imageHash);

        if (existingImage && sessionHistory.has(imageHash)) {
          // Image already processed and used in this session
          // Create a reference instead of sending the image again
          const reference = {
            type: 'image_reference',
            referenceId: existingImage.referenceId,
            hash: imageHash,
            description: existingImage.description,
            firstUsedAt: existingImage.firstUsedAt,
            referencedAt: Date.now(),
            metadata: existingImage.metadata
          };
          
          imageReferences.push(reference);
          
          console.log(`🔗 Using image reference for previously sent image (${existingImage.metadata?.fileSize || 'unknown size'})`);
        } else {
          // New image or first time in this session
          const referenceId = this.generateReferenceId();
          const now = Date.now();
          
          // Store image data with context
          const imageContext = {
            referenceId,
            hash: imageHash,
            imageData: image,
            firstUsedAt: now,
            description: this.generateImageDescription(image),
            metadata: this.extractImageMetadata(image),
            sessionId
          };
          
          this.imageCache.set(imageHash, imageContext);
          sessionHistory.add(imageHash);
          this.sessionImageHistory.set(sessionId, sessionHistory);
          
          // Send the actual image
          imagesToSend.push(image);
          
          console.log(`📤 Sending new image (${imageContext.metadata?.fileSize || 'unknown size'}) - Reference ID: ${referenceId}`);
        }
      } catch (error) {
        console.warn('Failed to process image for context:', error);
        // Fallback: send the image anyway
        imagesToSend.push(image);
      }
    }

    return { imagesToSend, imageReferences };
  }

  /**
   * Generate a description for an image based on its metadata
   */
  generateImageDescription(image) {
    if (image && typeof image === 'object' && image.metadata) {
      const { width, height, format, sizeKB } = image.metadata;
      return `${format.toUpperCase()} image (${width}×${height}, ${sizeKB.toFixed(1)}KB)`;
    } else if (image instanceof HTMLCanvasElement) {
      return `Canvas drawing (${image.width}×${image.height})`;
    } else {
      return 'Image attachment';
    }
  }

  /**
   * Extract metadata from image object
   */
  extractImageMetadata(image) {
    if (image && typeof image === 'object' && image.metadata) {
      return image.metadata;
    } else if (image instanceof HTMLCanvasElement) {
      return {
        width: image.width,
        height: image.height,
        format: 'png',
        originalWidth: image.width,
        originalHeight: image.height
      };
    } else {
      return null;
    }
  }

  /**
   * Create a text reference message for previously sent images
   */
  createImageReferenceText(references) {
    if (!references || references.length === 0) {
      return '';
    }

    const referenceTexts = references.map(ref => {
      const timeSince = Math.floor((Date.now() - ref.firstUsedAt) / 1000);
      const timeText = timeSince < 60 ? 'just now' : 
                     timeSince < 3600 ? `${Math.floor(timeSince / 60)}m ago` :
                     `${Math.floor(timeSince / 3600)}h ago`;
      
      return `[Referring to ${ref.description} sent ${timeText}]`;
    });

    return referenceTexts.join(' ');
  }

  /**
   * Get cached image by reference ID
   */
  getCachedImage(referenceId) {
    for (const [hash, imageContext] of this.imageCache.entries()) {
      if (imageContext.referenceId === referenceId) {
        return imageContext;
      }
    }
    return null;
  }

  /**
   * Clear session history (but keep image cache)
   */
  clearSession(sessionId = 'default') {
    this.sessionImageHistory.delete(sessionId);
    console.log(`🧹 Cleared image history for session: ${sessionId}`);
  }

  /**
   * Clear all cached images and session history
   */
  clearAll() {
    this.imageCache.clear();
    this.sessionImageHistory.clear();
    this.referenceCounter = 0;
    console.log('🧹 Cleared all image cache and session history');
  }

  /**
   * Get statistics about cached images
   */
  getStats() {
    const totalImages = this.imageCache.size;
    const totalSessions = this.sessionImageHistory.size;
    const totalReferences = Array.from(this.sessionImageHistory.values())
      .reduce((sum, session) => sum + session.size, 0);

    return {
      totalImages,
      totalSessions,
      totalReferences,
      averageReferencesPerSession: totalSessions > 0 ? (totalReferences / totalSessions).toFixed(1) : 0
    };
  }

  /**
   * Get session-specific stats
   */
  getSessionStats(sessionId = 'default') {
    const sessionHistory = this.sessionImageHistory.get(sessionId);
    if (!sessionHistory) {
      return { sessionId, imageCount: 0, uniqueImages: [] };
    }

    const uniqueImages = Array.from(sessionHistory).map(hash => {
      const imageContext = this.imageCache.get(hash);
      return {
        referenceId: imageContext?.referenceId,
        description: imageContext?.description,
        firstUsedAt: imageContext?.firstUsedAt
      };
    });

    return {
      sessionId,
      imageCount: sessionHistory.size,
      uniqueImages
    };
  }
}

// Create and export singleton instance
const imageContextService = new ImageContextService();
export default imageContextService; 