/**
 * Image Compression Configuration
 * Adjust these settings based on your model's capabilities and document types
 */

export const compressionConfig = {
  // Model-specific limits (adjust based on your llama.cpp setup)
  modelLimits: {
    // Conservative defaults for most vision models
    default: {
      maxWidth: 1024,
      maxHeight: 1024,
      maxSizeBytes: 2 * 1024 * 1024, // 2MB
    },
    
    // Specific model configurations
    'gemma3:4b': {
      maxWidth: 1280,
      maxHeight: 1280,
      maxSizeBytes: 3 * 1024 * 1024, // 3MB - Gemma can handle larger images
    },
    
    'qwen-vl:7b': {
      maxWidth: 1024,
      maxHeight: 1024,
      maxSizeBytes: 2.5 * 1024 * 1024, // 2.5MB
    }
  },

  // Document type presets
  documentTypes: {
    architectural: {
      preserveLines: true,
      enhanceContrast: true,
      sharpenText: true,
      minQuality: 0.85,
      preferredFormat: 'jpeg', // JPEG usually better for architectural drawings
    },
    
    photograph: {
      preserveLines: false,
      enhanceContrast: false,
      sharpenText: false,
      minQuality: 0.80,
      preferredFormat: 'jpeg',
    },
    
    diagram: {
      preserveLines: true,
      enhanceContrast: true,
      sharpenText: true,
      minQuality: 0.90,
      preferredFormat: 'png', // PNG better for diagrams with text
    },
    
    general: {
      preserveLines: false,
      enhanceContrast: false,
      sharpenText: false,
      minQuality: 0.75,
      preferredFormat: 'jpeg',
    }
  },

  // Quality levels
  qualityPresets: {
    maximum: 0.95,    // Highest quality, larger file
    high: 0.90,       // Good balance for detailed work
    medium: 0.80,     // General use
    low: 0.65,        // Quick preview/draft
    minimum: 0.50     // Emergency compression
  },

  // Processing options
  processing: {
    // Enable progressive compression (try different quality levels)
    useProgressiveCompression: true,
    
    // Number of compression attempts
    maxCompressionAttempts: 5,
    
    // Quality reduction per attempt
    qualityReductionStep: 0.10,
    
    // Enable content analysis for automatic settings
    enableContentAnalysis: true,
    
    // Log compression details to console
    enableLogging: true,
  },

  // Error handling
  fallback: {
    // Fallback to PNG if JPEG compression fails
    usePngFallback: true,
    
    // Maximum attempts before giving up
    maxFallbackAttempts: 3,
    
    // If all else fails, try extreme compression
    useEmergencyCompression: true,
    emergencyMaxSize: 1024 * 1024, // 1MB emergency limit
  }
};

/**
 * Get compression settings for a specific model and document type
 */
export function getCompressionSettings(modelId = 'default', documentType = 'architectural') {
  const modelLimits = compressionConfig.modelLimits[modelId] || compressionConfig.modelLimits.default;
  const documentSettings = compressionConfig.documentTypes[documentType] || compressionConfig.documentTypes.general;
  
  return {
    ...modelLimits,
    ...documentSettings,
    processing: compressionConfig.processing,
    fallback: compressionConfig.fallback
  };
}

/**
 * Update configuration at runtime (useful for user preferences)
 */
export function updateCompressionConfig(updates) {
  Object.assign(compressionConfig, updates);
}

export default compressionConfig; 