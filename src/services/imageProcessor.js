/**
 * Image Processor Service - Intelligent compression and optimization for AI models
 * Specialized for architectural documents with detail preservation
 */

import { getCompressionSettings } from '../config/imageCompression.js';

class ImageProcessor {
  constructor() {
    // Default configuration (will be overridden by getCompressionSettings)
    this.config = {
      // Maximum dimensions before compression is required
      maxWidth: 1024,
      maxHeight: 1024,
      
      // Maximum file size in bytes (2MB base64 ≈ 1.5MB image)
      maxSizeBytes: 2 * 1024 * 1024,
      
      // Quality settings for different compression levels
      qualityLevels: {
        high: 0.95,      // For detailed architectural drawings
        medium: 0.85,    // For general documents
        low: 0.75        // For quick previews
      },
      
      // Architectural document specific settings
      architectural: {
        preserveLines: true,
        enhanceContrast: true,
        sharpenText: true,
        minQuality: 0.85  // Never go below this for architectural docs
      }
    };
  }

  /**
   * Get optimized settings for a specific model and content type
   */
  getOptimizedSettings(modelId, documentType = 'architectural') {
    return getCompressionSettings(modelId, documentType);
  }

  /**
   * Analyze image content to determine optimal processing strategy
   */
  analyzeImageContent(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    let edgePixels = 0;
    let contrastSum = 0;
    
    // Sample analysis (every 10th pixel for performance)
    for (let i = 0; i < data.length; i += 40) { // RGBA = 4 bytes, so 40 = every 10th pixel
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;
      
      // Simple edge detection (high contrast between adjacent pixels)
      if (i + 40 < data.length) {
        const nextR = data[i + 40];
        const nextG = data[i + 41];
        const nextB = data[i + 42];
        const nextBrightness = (nextR + nextG + nextB) / 3;
        
        const contrast = Math.abs(brightness - nextBrightness);
        contrastSum += contrast;
        
        if (contrast > 50) { // Threshold for edge detection
          edgePixels++;
        }
      }
    }
    
    const sampleCount = data.length / 40;
    const avgBrightness = totalBrightness / sampleCount;
    const avgContrast = contrastSum / (sampleCount - 1);
    const edgeRatio = edgePixels / sampleCount;
    
    // Classify content type
    const isArchitectural = edgeRatio > 0.15 && avgContrast > 30; // High edges + contrast = likely architectural
    const isDetailed = edgeRatio > 0.1;
    const isDarkBackground = avgBrightness < 85;
    
    return {
      isArchitectural,
      isDetailed,
      isDarkBackground,
      edgeRatio,
      avgContrast,
      avgBrightness
    };
  }

  /**
   * Calculate optimal dimensions maintaining aspect ratio
   */
  calculateOptimalDimensions(width, height, maxWidth = this.config.maxWidth, maxHeight = this.config.maxHeight) {
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height };
    }
    
    const aspectRatio = width / height;
    
    let newWidth, newHeight;
    
    if (aspectRatio > 1) {
      // Landscape
      newWidth = Math.min(width, maxWidth);
      newHeight = Math.round(newWidth / aspectRatio);
      
      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = Math.round(newHeight * aspectRatio);
      }
    } else {
      // Portrait or square
      newHeight = Math.min(height, maxHeight);
      newWidth = Math.round(newHeight * aspectRatio);
      
      if (newWidth > maxWidth) {
        newWidth = maxWidth;
        newHeight = Math.round(newWidth / aspectRatio);
      }
    }
    
    return { width: newWidth, height: newHeight };
  }

  /**
   * Apply image sharpening for better text/line clarity
   */
  applySharpeningFilter(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Create a copy for processing
    const originalData = new Uint8ClampedArray(data);
    
    // Sharpening kernel (unsharp mask)
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) { // RGB channels only
          let sum = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              const kernelIdx = (ky + 1) * 3 + (kx + 1);
              sum += originalData[idx] * kernel[kernelIdx];
            }
          }
          
          const idx = (y * width + x) * 4 + c;
          data[idx] = Math.max(0, Math.min(255, sum));
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Enhance contrast for better visibility of architectural details
   */
  enhanceContrast(canvas, factor = 1.2) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast enhancement to RGB channels
      for (let c = 0; c < 3; c++) {
        let value = data[i + c];
        // Apply contrast: newValue = (value - 128) * factor + 128
        value = (value - 128) * factor + 128;
        data[i + c] = Math.max(0, Math.min(255, value));
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Resize canvas with high-quality scaling
   */
  resizeCanvas(sourceCanvas, targetWidth, targetHeight) {
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
    
    const ctx = targetCanvas.getContext('2d');
    
    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the resized image
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    
    return targetCanvas;
  }

  /**
   * Get estimated base64 size
   */
  estimateBase64Size(canvas, quality = 0.9) {
    // PNG base64 is roughly 1.37x the actual image size
    // JPEG base64 varies by quality and content
    const pixelCount = canvas.width * canvas.height;
    const estimatedBytes = pixelCount * 3 * quality * 1.37; // RGB * quality factor * base64 overhead
    return estimatedBytes;
  }

  /**
   * Process image with intelligent compression for AI models
   */
  async processImageForAI(sourceCanvas, options = {}) {
    const {
      targetType = 'architectural',
      modelId = 'default',
      maxSizeBytes,
      maxWidth,
      maxHeight,
      forceCompression = false
    } = options;

    // Get optimized settings for this model and document type
    const settings = this.getOptimizedSettings(modelId, targetType);
    
    // Override with user-provided options
    const finalSettings = {
      maxWidth: maxWidth || settings.maxWidth,
      maxHeight: maxHeight || settings.maxHeight,
      maxSizeBytes: maxSizeBytes || settings.maxSizeBytes,
      minQuality: settings.minQuality,
      enhanceContrast: settings.enhanceContrast,
      sharpenText: settings.sharpenText,
      preferredFormat: settings.preferredFormat || 'jpeg'
    };

    if (settings.processing?.enableLogging) {
      console.log(`Processing image for ${modelId} (${targetType}): ${sourceCanvas.width}x${sourceCanvas.height}`);
      console.log('Using settings:', finalSettings);
    }
    
    // Analyze content
    const analysis = this.analyzeImageContent(sourceCanvas);
    if (settings.processing?.enableLogging) {
      console.log('Image analysis:', analysis);
    }
    
    // Create working copy
    let workingCanvas = document.createElement('canvas');
    workingCanvas.width = sourceCanvas.width;
    workingCanvas.height = sourceCanvas.height;
    let ctx = workingCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);
    
    // Apply enhancements based on settings and analysis
    if ((targetType === 'architectural' || analysis.isArchitectural) && settings.enhanceContrast) {
      this.enhanceContrast(workingCanvas, 1.15);
    }
    
    if (settings.sharpenText && analysis.isDetailed) {
      this.applySharpeningFilter(workingCanvas);
    }
    
    // Calculate optimal dimensions
    const optimalDims = this.calculateOptimalDimensions(
      workingCanvas.width, 
      workingCanvas.height, 
      finalSettings.maxWidth, 
      finalSettings.maxHeight
    );
    
    // Resize if needed
    if (optimalDims.width !== workingCanvas.width || optimalDims.height !== workingCanvas.height || forceCompression) {
      if (settings.processing?.enableLogging) {
        console.log(`Resizing from ${workingCanvas.width}x${workingCanvas.height} to ${optimalDims.width}x${optimalDims.height}`);
      }
      workingCanvas = this.resizeCanvas(workingCanvas, optimalDims.width, optimalDims.height);
    }
    
    // Determine optimal quality and format
    let quality = finalSettings.minQuality;
    let useFormat = finalSettings.preferredFormat;
    
    // Test compression levels to meet size requirements
    let base64Result;
    let attempts = 0;
    const maxAttempts = settings.processing?.maxCompressionAttempts || 5;
    const qualityStep = settings.processing?.qualityReductionStep || 0.10;
    
    while (attempts < maxAttempts) {
      try {
        const format = useFormat === 'png' ? 'image/png' : 'image/jpeg';
        base64Result = workingCanvas.toDataURL(format, quality);
        const sizeBytes = base64Result.length * 0.75;
        
        if (settings.processing?.enableLogging) {
          console.log(`Compression attempt ${attempts + 1}: Quality ${quality.toFixed(2)}, Format ${useFormat}, Size: ${(sizeBytes / 1024).toFixed(1)}KB`);
        }
        
        if (sizeBytes <= finalSettings.maxSizeBytes || quality <= 0.5) {
          break;
        }
        
        // Reduce quality for next attempt
        quality = Math.max(0.5, quality - qualityStep);
        attempts++;
      } catch (error) {
        console.error('Compression error:', error);
        break;
      }
    }
    
    // Fallback handling
    if (!base64Result && settings.fallback?.usePngFallback && useFormat !== 'png') {
      if (settings.processing?.enableLogging) {
        console.log('Falling back to PNG compression');
      }
      base64Result = workingCanvas.toDataURL('image/png');
      useFormat = 'png';
    }
    
    // Emergency compression if still too large
    if (settings.fallback?.useEmergencyCompression) {
      const sizeBytes = base64Result.length * 0.75;
      if (sizeBytes > settings.fallback.emergencyMaxSize) {
        if (settings.processing?.enableLogging) {
          console.log('Applying emergency compression');
        }
        
        // Further reduce dimensions
        const emergencyDims = this.calculateOptimalDimensions(
          workingCanvas.width,
          workingCanvas.height,
          Math.min(800, finalSettings.maxWidth),
          Math.min(800, finalSettings.maxHeight)
        );
        
        if (emergencyDims.width < workingCanvas.width || emergencyDims.height < workingCanvas.height) {
          workingCanvas = this.resizeCanvas(workingCanvas, emergencyDims.width, emergencyDims.height);
          base64Result = workingCanvas.toDataURL('image/jpeg', 0.5);
        }
      }
    }
    
    // Extract just the base64 data
    const base64Data = base64Result.split(',')[1];
    const finalSizeKB = (base64Data.length * 0.75) / 1024;
    
    if (settings.processing?.enableLogging) {
      console.log(`Final image: ${workingCanvas.width}x${workingCanvas.height}, ${finalSizeKB.toFixed(1)}KB, ${useFormat}`);
    }
    
    return {
      base64: base64Data,
      width: workingCanvas.width,
      height: workingCanvas.height,
      sizeKB: finalSizeKB,
      format: useFormat,
      quality: quality,
      analysis: analysis,
      settings: finalSettings
    };
  }

  /**
   * Quick size check without full processing
   */
  needsCompression(canvas, maxSizeBytes = this.config.maxSizeBytes) {
    const estimatedSize = this.estimateBase64Size(canvas, 0.9);
    const needsDimensionReduction = canvas.width > this.config.maxWidth || canvas.height > this.config.maxHeight;
    const needsSizeReduction = estimatedSize > maxSizeBytes;
    
    return {
      needed: needsDimensionReduction || needsSizeReduction,
      reason: needsDimensionReduction ? 'dimensions' : needsSizeReduction ? 'size' : 'none',
      estimatedSize: estimatedSize,
      currentDimensions: { width: canvas.width, height: canvas.height }
    };
  }
}

// Export singleton instance
export const imageProcessor = new ImageProcessor();
export default imageProcessor; 