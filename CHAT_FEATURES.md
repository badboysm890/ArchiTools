# Chat Features

## Overview

The application now includes a comprehensive AI chat system with the following features:

- **Model Selection**: Choose from multiple available AI models
- **Text Chat**: Standard text conversation with streaming responses
- **Image Analysis**: Upload images for AI analysis (Gemma 3 model only)
- **Real-time Streaming**: Live response streaming for better UX
- **Persistent Chat History**: Messages are saved in Redux store

## Features

### Model Selection
- **Available Models**:
  - Qwen 3 (0.6B) - Fast, lightweight text model
  - Qwen VL (7B) - Vision-language model 
  - **Gemma 3 (4B)** - Recommended for images ⭐
  - Llama 3 (1B) - General purpose text model
  - TinyLlama (1.1B) - Very fast, basic responses

### Image Support
- **Automatic Model Switching**: When you upload images, the system automatically switches to Gemma 3 (4B)
- **Multiple Image Upload**: Upload multiple images at once
- **Image Preview**: See selected images before sending
- **Base64 Conversion**: Images are automatically converted for API compatibility

### Chat Interface
- **Streaming Responses**: See AI responses in real-time as they're generated
- **Visual Indicators**: Loading states, typing indicators, and status dots
- **Message History**: All conversations are preserved
- **Responsive Design**: Clean, modern chat interface

## Usage

### Starting a Chat
1. Type your message in the text input at the bottom
2. Press Enter or click the send button
3. Watch the AI respond in real-time

### Using Images
1. Click the image button (📷) in the chat input
2. Select one or more images from your device
3. The system will automatically switch to Gemma 3 model
4. Type a description of what you want to know about the image
5. Send the message

### Model Selection
1. Click on the model selector in the top-left of the chat input
2. Choose your preferred model from the dropdown
3. Note: Only Gemma 3 supports image analysis

### Controls
- **Stop Button**: Cancel a streaming response while it's generating
- **Clear Chat**: Clear all messages (coming soon)
- **Model Status**: Green dot = ready, Yellow dot = processing

## Technical Details

### API Integration
- **Endpoint**: `http://localhost:8091/v1/chat/completions`
- **Streaming**: Server-Sent Events (SSE) for real-time responses
- **Authentication**: Bearer token authentication (`no-key`)
- **Image Format**: Base64 encoded images in OpenAI-compatible format

### Components
- `ChatService`: Core API communication library
- `useChat`: React hook for chat functionality  
- `ChatMessages`: Message display component
- `ChatInput`: Input interface with model selection
- `ChatSlice`: Redux state management

### State Management
- **Redux Store**: Messages, typing state, and chat context
- **Persistence**: Chat history is persisted between sessions
- **Real-time Updates**: Streaming messages update in real-time

## Example Usage

```javascript
// Using the chat service directly
import chatService from './services/chatService';

// Send a text message
const messages = [
  { role: 'user', content: 'Hello!' }
];

for await (const chunk of chatService.streamChatCompletion(messages, 'gemma3:4b')) {
  console.log(chunk.content);
}

// Send an image
const imageFile = ...; // File object
const content = await chatService.createMessageContent('Describe this image', [imageFile]);
```

## Notes

- **Image Support**: Only Gemma 3 (4B) model supports image analysis
- **Performance**: Larger models (7B) may be slower but more capable
- **Local Server**: Requires the LLM server to be running on localhost:8091
- **File Formats**: Supports common image formats (JPG, PNG, WebP, etc.) 