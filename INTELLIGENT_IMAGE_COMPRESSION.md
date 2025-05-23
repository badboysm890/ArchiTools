# Intelligent Image Compression for AI Models

## Overview

This system provides intelligent image compression specifically designed for architectural documents and technical drawings. It automatically optimizes images for AI model processing while preserving important details and reducing the likelihood of Metal GPU errors and memory issues.

## Key Features

### 🎯 Model-Specific Optimization
- **Automatic Model Detection**: Adjusts compression settings based on the selected AI model
- **Model Limits**: Respects each model's specific memory and size constraints
- **Gemma 3 (4B)**: Higher limits (1280x1280, 3MB) for better image analysis
- **Qwen VL (7B)**: Balanced settings (1024x1024, 2.5MB)
- **Default**: Conservative settings (1024x1024, 2MB) for unknown models

### 🏗️ Architectural Document Processing
- **Content Analysis**: Automatically detects architectural drawings vs photos
- **Line Preservation**: Maintains sharp lines and technical details
- **Contrast Enhancement**: Improves visibility of blueprints and technical drawings
- **Text Sharpening**: Enhances readability of annotations and labels
- **Quality Guarantee**: Never goes below 85% quality for architectural documents

### 🔧 Smart Compression Pipeline
1. **Content Analysis**: Analyzes image for edges, contrast, and content type
2. **Enhancement**: Applies architectural-specific filters if detected
3. **Dimension Optimization**: Calculates optimal size while maintaining aspect ratio
4. **Progressive Compression**: Tests multiple quality levels to meet size requirements
5. **Format Selection**: Chooses best format (JPEG/PNG) based on content
6. **Emergency Fallback**: Applies emergency compression if needed

### 📊 Visual Feedback
- **Compression Indicators**: Yellow dots show which canvases need compression
- **Size Estimates**: Displays estimated file sizes before processing
- **Processing Stats**: Shows compression details in console
- **Quality Information**: Hover tooltips with image dimensions

## How It Works

### Before (Problem)
```
Large architectural drawing (4000x3000) → 15MB base64 → Metal GPU error
```

### After (Solution)
```
Large architectural drawing (4000x3000) 
↓ Content Analysis (detected: architectural)
↓ Enhancement (contrast + sharpening)
↓ Resize (1280x960, maintaining aspect ratio)
↓ Smart JPEG compression (88% quality)
→ 650KB optimized image → Successful AI analysis
```

## Configuration

### Model-Specific Settings
Located in `src/config/imageCompression.js`:

```javascript
'gemma3:4b': {
  maxWidth: 1280,
  maxHeight: 1280,
  maxSizeBytes: 3 * 1024 * 1024, // 3MB - Gemma can handle larger images
}
```

### Document Type Presets
```javascript
architectural: {
  preserveLines: true,
  enhanceContrast: true,
  sharpenText: true,
  minQuality: 0.85,
  preferredFormat: 'jpeg'
}
```

### Quality Levels
- **Maximum (95%)**: Highest quality, larger file
- **High (90%)**: Good balance for detailed work
- **Medium (80%)**: General use
- **Low (65%)**: Quick preview/draft
- **Minimum (50%)**: Emergency compression

## Usage Examples

### Automatic Processing (Recommended)
```javascript
// Canvas service automatically detects and compresses
const result = await canvasService.captureCanvas('main-canvas', {
  targetType: 'architectural',
  modelId: 'gemma3:4b',
  useCompression: true
});
```

### Manual Configuration
```javascript
const result = await imageProcessor.processImageForAI(canvas, {
  targetType: 'architectural',
  modelId: 'gemma3:4b',
  maxWidth: 1024,
  maxHeight: 1024,
  maxSizeBytes: 2 * 1024 * 1024
});
```

## Visual Indicators

### Canvas Preview Area
- 🟡 **Yellow Dot**: Canvas needs compression
- 📊 **Size Info**: Hover for dimensions and compression status
- ⚠️ **Warning Panel**: Shows compression details when needed

### Console Logging
When enabled, provides detailed processing information:
```
Processing image for gemma3:4b (architectural): 2400x1800
Image analysis: { isArchitectural: true, edgeRatio: 0.23, avgContrast: 87 }
Resizing from 2400x1800 to 1024x768
Compression attempt 1: Quality 0.85, Format jpeg, Size: 421.3KB
Final image: 1024x768, 421.3KB, jpeg
```

## Performance Benefits

### Before Compression
- ❌ Metal GPU errors on large images
- ❌ Memory overflow issues
- ❌ Slow processing times
- ❌ Model failures

### After Compression
- ✅ Reliable processing of all image sizes
- ✅ Preserved architectural details
- ✅ Faster AI response times
- ✅ Better model compatibility
- ✅ Consistent quality results

## Error Prevention

### Common Issues Resolved
1. **`ggml_metal_graph_compute failed with status 5`**: Prevented by size limits
2. **`failed to process image`**: Avoided through progressive compression
3. **Memory allocation errors**: Resolved by dimension optimization
4. **Timeout errors**: Reduced through efficient compression

### Fallback Strategy
1. Try JPEG compression with progressive quality reduction
2. Fallback to PNG if JPEG fails
3. Apply emergency compression (further size reduction)
4. Provide detailed error logging for debugging

## Configuration Options

### For Different Use Cases

#### High-Detail Architectural Work
```javascript
updateCompressionConfig({
  documentTypes: {
    architectural: {
      minQuality: 0.90,
      maxWidth: 1280,
      maxHeight: 1280
    }
  }
});
```

#### Fast Processing Mode
```javascript
updateCompressionConfig({
  processing: {
    maxCompressionAttempts: 3,
    enableContentAnalysis: false
  }
});
```

#### Debug Mode
```javascript
updateCompressionConfig({
  processing: {
    enableLogging: true
  }
});
```

## Technical Details

### Content Analysis
- **Edge Detection**: Identifies high-contrast boundaries
- **Brightness Analysis**: Determines if image is dark/light
- **Contrast Measurement**: Evaluates detail level
- **Classification**: Architectural vs photo detection

### Enhancement Filters
- **Unsharp Mask**: 3x3 kernel for line sharpening
- **Contrast Enhancement**: Selective RGB channel enhancement
- **High-Quality Scaling**: Browser's best interpolation

### Compression Algorithm
- **Progressive Quality**: Starts high, reduces incrementally
- **Size Monitoring**: Real-time size checking
- **Format Optimization**: JPEG for photos, PNG for diagrams
- **Emergency Handling**: Extreme compression as last resort

## Troubleshooting

### Image Still Too Large
1. Check model-specific limits in configuration
2. Enable emergency compression
3. Reduce maximum dimensions
4. Try different document type preset

### Quality Issues
1. Increase minimum quality setting
2. Disable automatic enhancements
3. Use PNG format for diagrams
4. Check content analysis results

### Processing Errors
1. Enable debug logging
2. Check console for detailed error messages
3. Try fallback compression options
4. Verify canvas content is valid

## Future Enhancements

- **Tile-based Processing**: For extremely large images
- **AI-Guided Compression**: Using model feedback for optimization
- **Custom Enhancement Filters**: User-defined processing pipelines
- **Batch Processing**: Multiple image optimization
- **Quality Prediction**: Pre-processing quality estimation 