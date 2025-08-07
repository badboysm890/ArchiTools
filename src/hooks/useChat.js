import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addMessage, updateMessage, setTyping, clearMessages, deduplicateMessages } from '../store/slices/chatSlice';
import { setSelectedModel } from '../store/slices/providersSlice';
import chatService from '../services/chatService';
import providerService from '../services/providerService';

export function useChat() {
  const dispatch = useDispatch();
  const { messages, isTyping } = useSelector(state => state.chat || {});
  const { 
    selectedModel = 'qwen-vl:7b', 
    activeProviderId = 'llamacpp', 
    providers = [] 
  } = useSelector(state => state.providers || {});
  
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Refs for tracking streaming state
  const streamingRef = useRef(false);
  const currentStreamRef = useRef(null);
  
  // Session ID for image context (you can make this dynamic per conversation)
  const [sessionId] = useState(`session_${Date.now()}`);

  // Load available models on mount and when provider changes
  useEffect(() => {
    const loadModels = async () => {
      try {
        await chatService.initialize();
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
  }, [dispatch, activeProviderId]);

  // Update available models when provider models change
  useEffect(() => {
    const activeProvider = providers.find(p => p.id === activeProviderId);
    if (activeProvider && activeProvider.models) {
      setAvailableModels(activeProvider.models);
    }
  }, [providers, activeProviderId]);

  // Auto-switch to image-capable model when images are present
  const getModelForMessage = useCallback((images = []) => {
    if (images && images.length > 0) {
      // Find first image-capable model in available models
      const imageCapableModel = availableModels.find(model => 
        chatService.isImageCapable(model)
      );
      return imageCapableModel || selectedModel;
    }
    return selectedModel;
  }, [selectedModel, availableModels]);

  // Send a message and stream the response with smart image handling
  const sendMessage = useCallback(async (text, images = [], modelOverride = null) => {
    if (streamingRef.current) {
      console.warn('Already streaming, ignoring new message');
      return;
    }

    setError(null);
    setIsLoading(true);
    
    try {
      // Create user message with session context
      const userMessage = chatService.createMessage('user', text, images, sessionId);
      dispatch(addMessage(userMessage));
      
      // Prepare messages for API with smart image handling
      const allMessages = [...messages, userMessage];
      const apiMessages = await chatService.formatMessagesForAPI(allMessages, sessionId);
      
      // Determine model to use (override takes precedence)
      const modelToUse = modelOverride || getModelForMessage(images);
      
      // Create assistant message placeholder
      const assistantMessage = chatService.createMessage('assistant', '', [], sessionId);
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
        'Sorry, I encountered an error while processing your message. Please try again.',
        [],
        sessionId
      );
      dispatch(addMessage(errorMessage));
      
    } finally {
      setIsLoading(false);
      dispatch(setTyping(false));
      streamingRef.current = false;
      currentStreamRef.current = null;
    }
  }, [messages, selectedModel, getModelForMessage, dispatch, sessionId]);

  // Cancel current stream
  const cancelStream = useCallback(() => {
    if (streamingRef.current && currentStreamRef.current) {
      streamingRef.current = false;
      currentStreamRef.current = null;
      dispatch(setTyping(false));
      setIsLoading(false);
    }
  }, [dispatch]);

  // Clear all messages and image context
  const clearChat = useCallback(() => {
    dispatch(clearMessages());
    // Clear image context for this session
    chatService.clearImageContext(sessionId);
    setError(null);
    console.log(`🧹 Cleared chat and image context for session: ${sessionId}`);
  }, [dispatch, sessionId]);

  // Check if selected model supports images
  const isImageSupported = useCallback(() => {
    return chatService.isImageCapable(selectedModel);
  }, [selectedModel]);

  // Get model display name using provider service
  const getModelDisplayName = useCallback((modelId) => {
    return providerService.getModelDisplayName(modelId);
  }, []);

  // Get image context statistics for debugging/monitoring
  const getImageStats = useCallback(() => {
    return chatService.getImageContextStats(sessionId);
  }, [sessionId]);

  return {
    // State
    messages,
    isTyping,
    isLoading,
    error,
    selectedModel,
    availableModels,
    isStreaming: streamingRef.current,
    sessionId,
    
    // Actions
    sendMessage,
    cancelStream,
    clearChat,
    setSelectedModel: (model) => dispatch(setSelectedModel(model)),
    
    // Utilities
    isImageSupported,
    getModelDisplayName,
    getImageStats,
    
    // Service methods (exposed for advanced usage)
    chatService
  };
} 