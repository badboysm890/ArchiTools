import React, { useEffect, useRef } from 'react';
import MarkdownMessage from './MarkdownMessage';

const ChatMessages = ({ messages, isTyping }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Debug check for duplicate message IDs (remove in production)
  useEffect(() => {
    const messageIds = messages.map(m => m.id);
    const uniqueIds = new Set(messageIds);
    if (messageIds.length !== uniqueIds.size) {
      console.warn('Duplicate message IDs detected:', messageIds);
      const duplicates = messageIds.filter((id, index) => messageIds.indexOf(id) !== index);
      console.warn('Duplicate IDs:', [...new Set(duplicates)]);
    }
  }, [messages]);

  const formatMessageContent = (content) => {
    if (typeof content === 'string') {
      return content;
    }
    
    // Handle OpenAI-style content array
    if (Array.isArray(content)) {
      return content.find(item => item.type === 'text')?.text || '';
    }
    
    return '';
  };

  const getMessageImages = (message) => {
    if (message.images && message.images.length > 0) {
      return message.images;
    }
    
    // Check if content has image_url items
    if (Array.isArray(message.content)) {
      return message.content
        .filter(item => item.type === 'image_url')
        .map(item => item.image_url.url);
    }
    
    return [];
  };

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const content = formatMessageContent(message.content);
    const images = getMessageImages(message);

    return (
      <div
        key={`${message.id}-${message.timestamp}-${index}`}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 chat-message-enter`}
      >
        <div
          className={`max-w-[80%] rounded-xl px-4 py-3 ${
            isUser
              ? 'bg-smortr-accent text-white ml-4'
              : 'bg-smortr-card text-smortr-text mr-4 border border-smortr-border'
          }`}
        >
          {/* Display images if present */}
          {images.length > 0 && (
            <div className="mb-3 space-y-2">
              {images.map((image, imgIndex) => (
                <div key={imgIndex} className="rounded-lg overflow-hidden">
                  <img
                    src={
                      typeof image === 'string'
                        ? (image.startsWith('data:') ? image : `data:image/png;base64,${image}`)
                        : URL.createObjectURL(image)
                    }
                    alt={`Uploaded image ${imgIndex + 1}`}
                    className="max-w-full h-auto max-h-64 object-contain rounded-lg"
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* Message content with markdown formatting */}
          {content && (
            <MarkdownMessage content={content} isUser={isUser} />
          )}
          
          {/* Streaming indicator for assistant messages */}
          {isAssistant && message.isStreaming && (
            <div className="flex items-center mt-2 opacity-70">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-current rounded-full typing-dots"></div>
                <div className="w-1 h-1 bg-current rounded-full typing-dots"></div>
                <div className="w-1 h-1 bg-current rounded-full typing-dots"></div>
              </div>
              <span className="ml-2 text-xs">Thinking...</span>
            </div>
          )}
          
          {/* Debug info (remove in production) */}
          {isAssistant && process.env.NODE_ENV === 'development' && (
            <div className="text-xs mt-1 opacity-50 text-gray-500">
              Streaming: {message.isStreaming ? 'true' : 'false'}
            </div>
          )}
          
          {/* Timestamp */}
          <div className={`text-xs mt-2 opacity-60 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-smortr-text-secondary">
          <div className="text-center">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
            <p>Ask me anything or upload an image to analyze!</p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message, index) => renderMessage(message, index))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div key="typing-indicator" className="flex justify-start mb-4 chat-message-enter">
              <div className="bg-smortr-card text-smortr-text rounded-xl px-4 py-3 mr-4 border border-smortr-border">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-smortr-accent rounded-full typing-dots"></div>
                    <div className="w-2 h-2 bg-smortr-accent rounded-full typing-dots"></div>
                    <div className="w-2 h-2 bg-smortr-accent rounded-full typing-dots"></div>
                  </div>
                  <span className="text-sm text-smortr-text-secondary">AI is typing...</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages; 