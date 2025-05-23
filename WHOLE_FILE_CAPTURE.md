# Whole File Capture Feature

## Overview

The application now supports two capture modes for images and documents:
- **Visible Area** (default): Captures only what's currently visible in the viewport
- **Whole File**: Captures the entire file/document as a complete image

## How to Use

### Toggle Between Modes

In the chat input area, you'll find a capture mode toggle with two options:

1. **🖼️ Visible** - Captures the current viewport/visible area
2. **📄 Whole File** - Captures the entire file content

### When to Use Each Mode

#### Visible Area Mode (Default)
- ✅ Good for discussing specific details currently on screen
- ✅ Smaller file sizes, faster processing
- ✅ Works well with zoomed-in views
- ✅ Ideal for focused analysis of particular sections

#### Whole File Mode
- ✅ Perfect for providing complete context to the AI
- ✅ Captures entire document/image regardless of zoom level
- ✅ Essential for overall analysis and comparisons
- ✅ Better for understanding relationships between different parts
- ⚠️ Larger file sizes (automatically compressed)
- ⚠️ May take longer to process

## Supported File Types

### Images (PNG, JPG, etc.)
- **Visible**: Current canvas viewport
- **Whole File**: Full resolution original image (with intelligent compression)

### PDFs
- **Visible**: Current page viewport  
- **Whole File**: ✅ **NOW SUPPORTED** - Renders all pages (up to 5 pages) from the actual PDF file
  - Fetches the complete PDF from the server
  - Renders each page at high resolution using PDF.js
  - Automatically compresses each page for optimal AI processing
  - Sends all pages to the AI for complete document analysis

### Other Files
- **Visible**: Current view
- **Whole File**: Falls back to file URL

## Technical Details

### PDF Processing (NEW)
- **Full PDF Rendering**: Fetches the actual PDF file from the server
- **Multi-page Support**: Renders up to 5 pages automatically (prevents overwhelming the AI)
- **High Quality**: Uses 2x scale for crisp text and graphics
- **Smart Compression**: Each page compressed to ~1.5MB with quality optimization
- **Page Metadata**: Includes page numbers and total page count

### Image Processing
- Whole file captures are automatically compressed using intelligent algorithms
- Maximum size limits: 2MB, 3000x3000 pixels
- Maintains quality while optimizing for AI analysis
- Includes metadata about original vs. processed dimensions

### Canvas Capture Improvements
- **Source Image Detection**: Attempts to find and use the original source image
- **Full Resolution**: Captures at original image dimensions when possible
- **Viewport Fallback**: Falls back to canvas viewport if source image unavailable
- **Smart Processing**: Detects the best capture method automatically

### Smart Integration
- Works with the existing Smart Image Context System
- Cached images include capture mode information
- Visual indicators show when whole file mode is active

### Performance
- Automatic compression prevents oversized uploads
- Canvas rendering optimized for large images
- Background processing to maintain UI responsiveness

## Visual Indicators

- **Blue indicator badge**: "📄 Whole file capture enabled" when active
- **Button highlighting**: Selected capture mode is highlighted in accent color
- **Status messages**: Console logs show capture details and file sizes

## Example Use Cases

### Architectural Drawings
- **Visible**: "What's this detail in the corner?"
- **Whole File**: "Analyze the overall layout and structural elements"

### Documents
- **Visible**: "Explain this specific paragraph"
- **Whole File**: "Summarize the entire document"

### Comparisons
- **Visible**: Compare specific sections between two files
- **Whole File**: Compare overall layouts and structures

## Troubleshooting

### Large File Warnings
If you see compression warnings, the system is automatically optimizing large files for better performance.

### PDF Processing
- **Multi-page PDFs**: Only the first 5 pages are processed to prevent overwhelming the AI
- **PDF.js Required**: Ensure PDF.js is loaded for PDF processing (automatically included)
- **Large PDFs**: Very large PDF files may take longer to process - progress is logged to console

### Memory Usage
Whole file capture uses more memory temporarily. If you experience slowdowns, switch back to visible mode.

### Canvas Source Detection
- The system attempts to find the original source image for canvas captures
- If no source image is found, it falls back to the viewport canvas
- Check console logs to see which capture method was used

## Benefits

1. **Complete Context**: AI gets the full picture for better analysis
2. **Flexible Analysis**: Choose the right capture mode for your specific needs
3. **Automatic Optimization**: Intelligent compression maintains quality while managing file sizes
4. **Seamless Integration**: Works with existing chat and comparison features
5. **Smart Caching**: Prevents duplicate processing while maintaining context

## Tips

- Start with **Whole File** mode for initial analysis
- Switch to **Visible** mode for detailed questions about specific areas
- Use **Whole File** mode when asking about overall structure or layout
- The mode persists across your session until manually changed 