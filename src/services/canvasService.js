/**
 * Canvas Service - Handles canvas operations and content capture
 */

import imageProcessor from './imageProcessor.js';

class CanvasService {
  constructor() {
    this.canvasRefs = new Map(); // Store canvas references by ID
  }

  /**
   * Register a canvas for capturing
   */
  registerCanvas(id, canvasRef) {
    this.canvasRefs.set(id, canvasRef);
  }

  /**
   * Unregister a canvas
   */
  unregisterCanvas(id) {
    this.canvasRefs.delete(id);
  }

  /**
   * Get canvas by ID
   */
  getCanvas(id) {
    const ref = this.canvasRefs.get(id);
    return ref?.current;
  }

  /**
   * Capture canvas content as base64 with intelligent compression
   */
  async captureCanvas(id, options = {}) {
    const canvas = this.getCanvas(id);
    if (!canvas) {
      throw new Error(`Canvas ${id} not found`);
    }

    try {
      const {
        useCompression = true,
        targetType = 'architectural',
        maxSizeBytes,
        maxWidth,
        maxHeight,
        captureMode = 'visible' // 'visible' or 'whole'
      } = options;

      // If whole file capture is requested, we need to handle it differently
      if (captureMode === 'whole') {
        // For whole file capture, we need to render the entire image at full size
        // This requires creating a temporary canvas with the full image dimensions
        return await this.captureWholeCanvas(canvas, {
          useCompression,
          targetType,
          modelId: options.modelId,
          maxSizeBytes,
          maxWidth,
          maxHeight
        });
      }

      // Standard visible area capture
      if (useCompression) {
        // Use intelligent image processing
        const result = await imageProcessor.processImageForAI(canvas, {
          targetType,
          modelId: options.modelId,
          maxSizeBytes,
          maxWidth,
          maxHeight
        });
        
        console.log(`Canvas ${id} processed:`, {
          originalSize: `${canvas.width}x${canvas.height}`,
          finalSize: `${result.width}x${result.height}`,
          fileSize: `${result.sizeKB.toFixed(1)}KB`,
          format: result.format,
          quality: result.quality
        });
        
        return {
          base64: result.base64,
          metadata: {
            width: result.width,
            height: result.height,
            originalWidth: canvas.width,
            originalHeight: canvas.height,
            sizeKB: result.sizeKB,
            format: result.format,
            quality: result.quality,
            analysis: result.analysis,
            captureMode: 'visible'
          }
        };
      } else {
        // Legacy behavior - direct PNG conversion
        const dataURL = canvas.toDataURL('image/png');
        const base64 = dataURL.split(',')[1];
        const sizeKB = (base64.length * 0.75) / 1024;
        
        return {
          base64,
          metadata: {
            width: canvas.width,
            height: canvas.height,
            originalWidth: canvas.width,
            originalHeight: canvas.height,
            sizeKB: sizeKB,
            format: 'png',
            quality: 1.0,
            captureMode: 'visible'
          }
        };
      }
    } catch (error) {
      console.error('Failed to capture canvas:', error);
      throw error;
    }
  }

  /**
   * Quick check if canvas needs compression
   */
  needsCompression(id) {
    const canvas = this.getCanvas(id);
    if (!canvas) {
      return { needed: false, reason: 'Canvas not found' };
    }
    
    return imageProcessor.needsCompression(canvas);
  }

  /**
   * Capture all registered canvases with compression
   */
  async captureAllCanvases(options = {}) {
    const captures = [];
    
    for (const [id, ref] of this.canvasRefs.entries()) {
      try {
        const result = await this.captureCanvas(id, options);
        captures.push({
          id,
          ...result,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn(`Failed to capture canvas ${id}:`, error);
      }
    }
    
    return captures;
  }

  /**
   * Get available canvases for capture
   */
  getAvailableCanvases() {
    const available = [];
    
    for (const [id, ref] of this.canvasRefs.entries()) {
      if (ref?.current) {
        const canvas = ref.current;
        const compressionInfo = this.needsCompression(id);
        
        available.push({
          id,
          canvas: canvas,
          width: canvas.width,
          height: canvas.height,
          compressionNeeded: compressionInfo.needed,
          compressionReason: compressionInfo.reason,
          estimatedSize: compressionInfo.estimatedSize
        });
      }
    }
    
    return available;
  }

  /**
   * Check if any canvases are available
   */
  hasAvailableCanvases() {
    return this.getAvailableCanvases().length > 0;
  }

  /**
   * Get compression statistics for all canvases
   */
  getCompressionStats() {
    const available = this.getAvailableCanvases();
    const stats = {
      total: available.length,
      needingCompression: 0,
      totalEstimatedSize: 0,
      reasons: {}
    };
    
    available.forEach(canvas => {
      if (canvas.compressionNeeded) {
        stats.needingCompression++;
        if (!stats.reasons[canvas.compressionReason]) {
          stats.reasons[canvas.compressionReason] = 0;
        }
        stats.reasons[canvas.compressionReason]++;
      }
      stats.totalEstimatedSize += canvas.estimatedSize || 0;
    });
    
    return stats;
  }

  /**
   * Capture entire file as image (for file URLs, not canvas)
   */
  async captureWholeFile(file) {
    try {
      console.log('Capturing whole file:', file.name, file.type);
      
      if (file.type === 'image') {
        // For images, load the full image and return it
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Handle CORS if needed
          
          img.onload = async () => {
            try {
              // Create a canvas with the full image dimensions
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              
              // Draw the full image
              ctx.drawImage(img, 0, 0);
              
              // Process with compression
              const result = await imageProcessor.processImageForAI(canvas, {
                targetType: 'architectural',
                maxSizeBytes: 2 * 1024 * 1024, // 2MB limit for whole files
                maxWidth: 3000, // Reasonable limit
                maxHeight: 3000
              });
              
              console.log('Whole image file captured:', {
                originalSize: `${img.naturalWidth}x${img.naturalHeight}`,
                finalSize: `${result.width}x${result.height}`,
                fileSize: `${result.sizeKB.toFixed(1)}KB`
              });
              
              resolve({
                base64: result.base64,
                metadata: {
                  width: result.width,
                  height: result.height,
                  originalWidth: img.naturalWidth,
                  originalHeight: img.naturalHeight,
                  sizeKB: result.sizeKB,
                  format: result.format,
                  quality: result.quality,
                  analysis: result.analysis,
                  captureMode: 'whole',
                  fileName: file.name
                }
              });
            } catch (error) {
              reject(error);
            }
          };
          
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = file.url;
        });
      } else if (file.type === 'pdf') {
        // For PDFs, fetch the file and render all pages
        return await this.capturePDFPages(file);
      } else {
        // For other file types, just return the URL as is
        // The chat service will handle it as a regular file
        return {
          url: file.url,
          metadata: {
            captureMode: 'whole',
            fileName: file.name,
            fileType: file.type
          }
        };
      }
    } catch (error) {
      console.error('Failed to capture whole file:', error);
      throw error;
    }
  }

  /**
   * Capture all pages of a PDF file as images
   */
  async capturePDFPages(file) {
    try {
      console.log('Capturing all pages from PDF:', file.name);
      
      // Check if PDF.js is available
      if (!window.pdfjsLib) {
        throw new Error('PDF.js not loaded. Cannot capture PDF pages.');
      }

      // Fetch the PDF file from the server
      const response = await fetch(file.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      console.log(`PDF loaded: ${pdf.numPages} pages`);
      
      const pageImages = [];
      const maxPagesForAI = 5; // Limit to prevent overwhelming the AI
      const pagesToRender = Math.min(pdf.numPages, maxPagesForAI);
      
      for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          
          // Use higher scale for better quality
          const scale = 2.0;
          const viewport = page.getViewport({ scale });
          
          // Create canvas for this page
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Render page to canvas
          await page.render({ 
            canvasContext: context, 
            viewport: viewport 
          }).promise;
          
          // Process with compression
          const result = await imageProcessor.processImageForAI(canvas, {
            targetType: 'architectural',
            maxSizeBytes: 1.5 * 1024 * 1024, // 1.5MB per page
            maxWidth: 2500,
            maxHeight: 2500
          });
          
          pageImages.push({
            base64: result.base64,
            metadata: {
              width: result.width,
              height: result.height,
              originalWidth: canvas.width,
              originalHeight: canvas.height,
              sizeKB: result.sizeKB,
              format: result.format,
              quality: result.quality,
              analysis: result.analysis,
              captureMode: 'whole',
              fileName: file.name,
              pageNumber: pageNum,
              totalPages: pdf.numPages
            }
          });
          
          console.log(`Page ${pageNum} captured: ${result.width}x${result.height}, ${result.sizeKB.toFixed(1)}KB`);
          
        } catch (pageError) {
          console.error(`Failed to capture page ${pageNum}:`, pageError);
        }
      }
      
      if (pageImages.length === 0) {
        throw new Error('Failed to capture any PDF pages');
      }
      
      // If we have multiple pages, return them as an array
      // If we have only one page, return it as a single image
      if (pageImages.length === 1) {
        return pageImages[0];
      } else {
        // Return multiple images
        return {
          multiplePages: true,
          pages: pageImages,
          metadata: {
            captureMode: 'whole',
            fileName: file.name,
            fileType: 'pdf',
            totalPages: pdf.numPages,
            capturedPages: pageImages.length,
            totalSize: pageImages.reduce((sum, page) => sum + page.metadata.sizeKB, 0)
          }
        };
      }
      
    } catch (error) {
      console.error('Failed to capture PDF pages:', error);
      throw new Error(`PDF capture failed: ${error.message}. Please use visible area mode for this PDF.`);
    }
  }

  /**
   * Capture whole canvas/image content (not just visible viewport)
   * This method tries to get the original source image from the canvas viewer
   */
  async captureWholeCanvas(viewportCanvas, options = {}) {
    try {
      console.log('Attempting to capture whole canvas content...');
      
      // Try to find the source image that was used to create this canvas
      // Look for image elements in the document that might be the source
      const images = document.querySelectorAll('img');
      let sourceImage = null;
      
      // Improved image detection - look for images that are likely to be the file content
      // Priority order: 1) Images near canvas elements, 2) Large images with file URLs, 3) Large images
      const candidateImages = [];
      
      for (const img of images) {
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          // Skip very small images (likely icons/logos/buttons)
          if (img.naturalWidth < 100 || img.naturalHeight < 100) {
            continue;
          }
          
          // Check various indicators that this is likely a file content image
          const isNearCanvas = !!img.closest('div[class*="canvas"], div[class*="viewer"], div[class*="file"]');
          const isLargeImage = img.naturalWidth > 500 && img.naturalHeight > 500;
          const hasFileUrl = img.src && (
            img.src.includes('/files/') || 
            img.src.includes('/download/') || 
            img.src.includes('/api/') ||
            img.src.startsWith('blob:') ||
            img.src.startsWith('data:image/')
          );
          
          // Skip images that are clearly UI elements
          const isUIElement = img.closest('nav, header, .navbar, .sidebar, .toolbar, .menu') ||
                             img.alt?.toLowerCase().includes('logo') ||
                             img.alt?.toLowerCase().includes('icon') ||
                             img.className?.toLowerCase().includes('logo') ||
                             img.className?.toLowerCase().includes('icon');
          
          if (isUIElement) {
            console.log('Skipping UI element image:', img.src.substring(0, 50) + '...');
            continue;
          }
          
          const score = (isNearCanvas ? 100 : 0) + 
                       (isLargeImage ? 50 : 0) + 
                       (hasFileUrl ? 75 : 0) +
                       (img.naturalWidth * img.naturalHeight / 10000); // Size factor
          
          candidateImages.push({
            img,
            score,
            debug: {
              isNearCanvas,
              isLargeImage,
              hasFileUrl,
              dimensions: `${img.naturalWidth}x${img.naturalHeight}`,
              src: img.src.substring(0, 100) + '...'
            }
          });
        }
      }
      
      // Sort by score and take the best candidate
      if (candidateImages.length > 0) {
        candidateImages.sort((a, b) => b.score - a.score);
        sourceImage = candidateImages[0].img;
        console.log('Selected source image based on scoring:', candidateImages[0].debug);
        console.log('All candidates:', candidateImages.map(c => ({ score: c.score, ...c.debug })));
      } else {
        console.log('No candidate images found for whole file capture');
      }
      
      let fullCanvas;
      let fullContext;
      
      if (sourceImage) {
        console.log('Found source image, using original dimensions:', 
          sourceImage.naturalWidth, 'x', sourceImage.naturalHeight);
        
        // Create a canvas with the full source image dimensions
        fullCanvas = document.createElement('canvas');
        fullContext = fullCanvas.getContext('2d');
        
        fullCanvas.width = sourceImage.naturalWidth;
        fullCanvas.height = sourceImage.naturalHeight;
        
        // Draw the full source image
        fullContext.drawImage(sourceImage, 0, 0);
        
      } else {
        console.log('No source image found, using viewport canvas');
        
        // Fallback: just use the viewport canvas
        fullCanvas = document.createElement('canvas');
        fullContext = fullCanvas.getContext('2d');
        
        fullCanvas.width = viewportCanvas.width;
        fullCanvas.height = viewportCanvas.height;
        
        // Copy the current canvas content
        fullContext.drawImage(viewportCanvas, 0, 0);
      }
      
      // Process with compression if enabled
      if (options.useCompression) {
        const result = await imageProcessor.processImageForAI(fullCanvas, {
          targetType: options.targetType,
          modelId: options.modelId,
          maxSizeBytes: options.maxSizeBytes || 2 * 1024 * 1024,
          maxWidth: options.maxWidth || 3000,
          maxHeight: options.maxHeight || 3000
        });
        
        console.log('Whole canvas captured and processed:', {
          originalSize: `${fullCanvas.width}x${fullCanvas.height}`,
          finalSize: `${result.width}x${result.height}`,
          fileSize: `${result.sizeKB.toFixed(1)}KB`,
          wasSourceImage: !!sourceImage
        });
        
        return {
          base64: result.base64,
          metadata: {
            width: result.width,
            height: result.height,
            originalWidth: fullCanvas.width,
            originalHeight: fullCanvas.height,
            sizeKB: result.sizeKB,
            format: result.format,
            quality: result.quality,
            analysis: result.analysis,
            captureMode: 'whole',
            wasSourceImage: !!sourceImage
          }
        };
      } else {
        // Direct conversion
        const dataURL = fullCanvas.toDataURL('image/png');
        const base64 = dataURL.split(',')[1];
        const sizeKB = (base64.length * 0.75) / 1024;
        
        return {
          base64,
          metadata: {
            width: fullCanvas.width,
            height: fullCanvas.height,
            originalWidth: fullCanvas.width,
            originalHeight: fullCanvas.height,
            sizeKB: sizeKB,
            format: 'png',
            quality: 1.0,
            captureMode: 'whole',
            wasSourceImage: !!sourceImage
          }
        };
      }
    } catch (error) {
      console.error('Failed to capture whole canvas:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const canvasService = new CanvasService();
export default canvasService; 