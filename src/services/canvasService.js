/**
 * Canvas Service - Handles canvas operations and content capture
 */

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
   * Capture canvas content as base64
   */
  captureCanvas(id) {
    const canvas = this.getCanvas(id);
    if (!canvas) {
      throw new Error(`Canvas ${id} not found`);
    }

    try {
      // Get canvas content as base64 data URL
      const dataURL = canvas.toDataURL('image/png');
      // Return just the base64 part (without data:image/png;base64,)
      return dataURL.split(',')[1];
    } catch (error) {
      console.error('Failed to capture canvas:', error);
      throw error;
    }
  }

  /**
   * Capture all registered canvases
   */
  captureAllCanvases() {
    const captures = [];
    
    for (const [id, ref] of this.canvasRefs.entries()) {
      try {
        const base64 = this.captureCanvas(id);
        captures.push({
          id,
          base64,
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
        available.push({
          id,
          canvas: ref.current,
          width: ref.current.width,
          height: ref.current.height
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
}

// Export singleton instance
export const canvasService = new CanvasService();
export default canvasService; 