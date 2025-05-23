import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, updateMessage, setTyping, clearMessages, deduplicateMessages } from '../store/slices/chatSlice';
import chatService from '../services/chatService';

export function useChat() {
  const dispatch = useDispatch();
  const { messages, isTyping } = useSelector(state => state.chat);
  
  const [selectedModel, setSelectedModel] = useState('gemma3:4b');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for tracking streaming state
  const streamingRef = useRef(false);
  const currentStreamRef = useRef(null);

  // Load available models on mount and clean up duplicates
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await chatService.getModels();
        setAvailableModels(models);
      } catch (err) {
        console.error('Failed to load models:', err);
        setError('Failed to load models');
      }
    };
    
    // Clean up any duplicate messages from persisted state
    dispatch(deduplicateMessages());
    
    loadModels();
  }, [dispatch]);

  // Auto-switch to image-capable model when images are present
  const getModelForMessage = useCallback((images = []) => {
    if (images && images.length > 0) {
      // Only gemma3:4b for images as per requirement
      return 'gemma3:4b';
    }
    return selectedModel;
  }, [selectedModel]);

  // Send a message and stream the response
  const sendMessage = useCallback(async (text, images = [], modelOverride = null) => {
    if (streamingRef.current) {
      console.warn('Already streaming, ignoring new message');
      return;
    }

    setError(null);
    setIsLoading(true);
    
    try {
      // Create user message
      const userMessage = chatService.createMessage('user', text, images);
      dispatch(addMessage(userMessage));
      
      // Prepare messages for API
      const allMessages = [...messages, userMessage];
      const apiMessages = await chatService.formatMessagesForAPI(allMessages);
      
      // Determine model to use (override takes precedence)
      const modelToUse = modelOverride || getModelForMessage(images);
      
      // Create assistant message placeholder
      const assistantMessage = chatService.createMessage('assistant', '');
      dispatch(addMessage(assistantMessage));
      dispatch(setTyping(true));
      
      streamingRef.current = true;
      let streamedContent = '';
      
      // Stream the response
      const stream = chatService.streamChatCompletion(apiMessages, modelToUse);
      currentStreamRef.current = stream;
      
      for await (const chunk of stream) {
        if (!streamingRef.current) {
          // Stream was cancelled
          break;
        }
        
        streamedContent += chunk.content;
        
        // Update the assistant message content using updateMessage instead of addMessage
        dispatch(updateMessage({
          id: assistantMessage.id,
          content: streamedContent,
          isStreaming: !chunk.finished
        }));
        
        if (chunk.finished) {
          break;
        }
      }
      
      // Ensure the message is marked as completed after streaming
      dispatch(updateMessage({
        id: assistantMessage.id,
        content: streamedContent,
        isStreaming: false
      }));
      
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
      
      // Add error message
      const errorMessage = chatService.createMessage(
        'assistant', 
        'Sorry, I encountered an error while processing your message. Please try again.'
      );
      dispatch(addMessage(errorMessage));
      
    } finally {
      setIsLoading(false);
      dispatch(setTyping(false));
      streamingRef.current = false;
      currentStreamRef.current = null;
    }
  }, [messages, selectedModel, getModelForMessage, dispatch]);

  // Cancel current stream
  const cancelStream = useCallback(() => {
    if (streamingRef.current && currentStreamRef.current) {
      streamingRef.current = false;
      currentStreamRef.current = null;
      dispatch(setTyping(false));
      setIsLoading(false);
    }
  }, [dispatch]);

  // Clear all messages
  const clearChat = useCallback(() => {
    dispatch(clearMessages());
    setError(null);
  }, [dispatch]);

  // Check if selected model supports images
  const isImageSupported = useCallback(() => {
    return chatService.isImageCapable(selectedModel);
  }, [selectedModel]);

  // Get model display name
  const getModelDisplayName = useCallback((modelId) => {
    const modelNames = {
      'qwen3:0.6b': 'Qwen 3 (0.6B)',
      'qwen-vl:7b': 'Qwen VL (7B)',
      'gemma3:4b': 'Gemma 3 (4B)',
      'llama3:1b': 'Llama 3 (1B)',
      'tinyllama:1.1b': 'TinyLlama (1.1B)'
    };
    return modelNames[modelId] || modelId;
  }, []);

  return {
    // State
    messages,
    isTyping,
    isLoading,
    error,
    selectedModel,
    availableModels,
    isStreaming: streamingRef.current,
    
    // Actions
    sendMessage,
    cancelStream,
    clearChat,
    setSelectedModel,
    
    // Utilities
    isImageSupported,
    getModelDisplayName,
    
    // Service methods (exposed for advanced usage)
    chatService
  };
} 