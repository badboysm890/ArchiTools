# Canvas Chat Features

## Overview

The application now supports advanced canvas-based image analysis with AI chat integration. Instead of traditional file uploads, the system can capture content directly from canvases in the viewer and send them to AI models for analysis.

## Key Features

### 🖼️ Canvas Image Capture
- **Automatic Detection**: The system automatically detects available canvases in the viewer
- **Real-time Capture**: Canvas content is captured as base64 PNG images when canvas toggle is enabled
- **Multiple Canvas Support**: Supports both main and comparison canvases simultaneously
- **No File Upload Required**: Eliminates the need for manual file selection

### 🔄 Dual Model Analysis
- **Split Screen Support**: When two canvases are available (main + comparison), enable dual model mode
- **Model Comparison**: Send the same prompt to two different models with different canvas images
- **Independent Responses**: Each model analyzes its respective canvas and provides separate responses
- **Model Selection**: Choose different models for primary and secondary analysis

### 🔧 OpenAI Integration
- **Llama.cpp Server**: Replaced custom fetch implementation with OpenAI library
- **Better Streaming**: Improved streaming performance and error handling
- **Standardized API**: Uses OpenAI-compatible API format for better compatibility
- **Multiple Model Support**: Dynamic model loading from the server

## Usage

### Basic Canvas Chat
1. **Load an image** in the main viewer (the canvas will automatically register)
2. **Toggle the Canvas switch** beside the chat input
   - When canvases are available, a "Canvas" toggle will appear next to the text input
   - Toggle it ON (green) to enable canvas capture
   - Shows the number of available canvases when enabled
3. **Type your question** about the image content
4. **Send the message** - the AI will analyze the canvas content

### Dual Model Comparison
1. **Load images** in both main and comparison viewers
2. **Enable "Dual Models"** button (appears when 2+ canvases are available)
3. **Select secondary model** from the dropdown that appears
4. **Enable Canvas toggle** 
5. **Type your comparison question**
6. **Send** - both models will analyze their respective canvases

### Model Selection
- **Primary Model**: Main model selector (default: Gemma 3 4B for image support)
- **Secondary Model**: Only available in dual model mode
- **Auto-switching**: Automatically switches to image-capable models when using canvas images

## Technical Implementation

### Canvas Service (`canvasService.js`)
```javascript
import canvasService from './services/canvasService';

// Register a canvas for capture
canvasService.registerCanvas('main-canvas', canvasRef);

// Capture canvas content
const base64Image = canvasService.captureCanvas('main-canvas');

// Get all available canvases
const availableCanvases = canvasService.getAvailableCanvases();
```

### Updated Chat Service
- **OpenAI Client**: Uses official OpenAI library with custom baseURL
- **Canvas Support**: Native support for HTMLCanvasElement in image processing
- **Base64 Handling**: Improved base64 image processing for various input types

### Canvas Registration
```javascript
// In CanvasViewer.jsx
useEffect(() => {
  const canvasId = isComparisonView ? 'comparison-canvas' : 'main-canvas';
  canvasService.registerCanvas(canvasId, canvasRef);
  
  return () => {
    canvasService.unregisterCanvas(canvasId);
  };
}, [isComparisonView]);
```

## Visual Indicators

### Canvas Toggle
- **OFF (Gray)**: Canvas images disabled
- **ON (Green)**: Canvas images enabled, shows count of available canvases
- **Label**: Shows "Canvas" with an image icon
- **Counter**: Displays number of available canvases when enabled

### Preview Area
- **Canvas Mode**: Shows canvas icons with labels (Main/Comp)
- **Image Mode**: Shows actual image thumbnails with remove buttons
- **Dual Model**: Shows "Dual model mode enabled" indicator

### Model Selector
- **Primary Model**: Always visible model selector
- **Dual Models Button**: Only appears when 2+ canvases available
- **Secondary Model**: Dropdown appears when dual mode is enabled

## Configuration

### Server Setup
Ensure your llama.cpp server is running on `http://localhost:8091` with OpenAI-compatible API:

```bash
# Example llama.cpp server command
./server -m your-model.gguf --port 8091 --api-key no-key
```

### Supported Models
- **Gemma 3 (4B)**: Recommended for image analysis ⭐
- **Qwen VL (7B)**: Vision-language model
- **Qwen 3 (0.6B)**: Fast text-only model
- **Llama 3 (1B)**: General purpose
- **TinyLlama (1.1B)**: Lightweight option

## Example Workflows

### 1. Single Image Analysis
```
1. Load image.jpg in main viewer
2. Toggle Canvas switch to ON (shows green with "1")
3. Type: "What objects do you see in this image?"
4. Send → AI analyzes canvas content
```

### 2. Image Comparison
```
1. Load image1.jpg in main viewer
2. Load image2.jpg in comparison viewer  
3. Enable Canvas toggle (shows "2")
4. Click "Dual Models" button
5. Select secondary model (e.g., Qwen VL 7B)
6. Type: "Compare these two images"
7. Send → Both models analyze their respective images
```

### 3. Technical Analysis
```
1. Load technical diagram in viewer
2. Enable Canvas toggle
3. Switch to Gemma 3 (4B) for best image support
4. Type: "Explain the technical components shown"
5. Send → Detailed technical analysis
```

## Interface Layout

### Chat Input Area
```
[Text Input Field]  [Canvas Toggle]  [Send Button]

Where Canvas Toggle shows:
🖼️ Canvas [●○○○○○○○○○○] 2
              ↑ toggle switch ↑ count
```

### When No Canvas Available
```
[Text Input Field]  [Upload Button]  [Send Button]
```

## Benefits

- **Simple Toggle Interface**: Easy on/off switch for canvas capture
- **Visual Feedback**: Clear indication of canvas availability and count
- **No File Management**: Direct capture eliminates file handling
- **Real-time Analysis**: Immediate analysis of current view state
- **Model Comparison**: Compare different AI perspectives on same content
- **Efficient Workflow**: Streamlined process for visual analysis
- **Better Performance**: OpenAI library provides improved streaming and error handling 