import React, { useEffect, useRef } from 'react';
import MarkdownMessage from './MarkdownMessage';

const ChatMessages = ({ messages, isTyping }) => {
  const messagesEndRef = useRef(null);
  const objectUrlsRef = useRef(new Set()); // Track created object URLs for cleanup

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Cleanup object URLs when component unmounts or messages change
  useEffect(() => {
    return () => {
      // Cleanup all created object URLs
      objectUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          console.warn('Failed to revoke object URL:', error);
        }
      });
      objectUrlsRef.current.clear();
    };
  }, [messages]);

  // Helper function to create and track object URLs
  const createTrackedObjectURL = (blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  };

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

  // Check if message content contains image references
  const getImageReferences = (content) => {
    if (typeof content === 'string') {
      // Look for image reference patterns in the text
      const referencePattern = /\[Referring to ([^\]]+)\]/g;
      const matches = [];
      let match;
      
      while ((match = referencePattern.exec(content)) !== null) {
        matches.push(match[1]);
      }
      
      return matches;
    }
    
    if (Array.isArray(content)) {
      const textContent = content.find(item => item.type === 'text')?.text || '';
      return getImageReferences(textContent);
    }
    
    return [];
  };

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const content = formatMessageContent(message.content);
    const images = getMessageImages(message);
    const imageReferences = getImageReferences(message.content);

    return (
      <div
        key={`${message.id}-${message.timestamp}-${index}`}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 chat-message-enter`}
      >
        <div
          className={`rounded-xl px-4 py-3 ${
            isUser
              ? 'bg-smortr-accent text-white ml-2 max-w-[85%]'
              : 'bg-smortr-card text-smortr-text mr-2 border border-smortr-border max-w-[90%]'
          }`}
        >
          {/* Display image references if present */}
          {imageReferences.length > 0 && (
            <div className="mb-3 space-y-1">
              {imageReferences.map((ref, refIndex) => (
                <div 
                  key={refIndex}
                  className="flex items-center space-x-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border border-blue-200 dark:border-blue-700"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                  <span>🔗 {ref}</span>
                </div>
              ))}
            </div>
          )}

          {/* Display images if present */}
          {images.length > 0 && (
            <div className="mb-3 space-y-2">
              {images.map((image, imgIndex) => {
                // Handle different image formats
                let imageSrc = '';
                let imageAlt = `Uploaded image ${imgIndex + 1}`;
                let imageInfo = null;

                if (typeof image === 'string') {
                  // Plain string - either data URL or base64
                  imageSrc = image.startsWith('data:') ? image : `data:image/png;base64,${image}`;
                } else if (image instanceof File || image instanceof Blob) {
                  // File or Blob object
                  imageSrc = createTrackedObjectURL(image);
                } else if (image && typeof image === 'object' && image.base64) {
                  // Compressed image object from our compression system
                  const format = image.metadata?.format || 'png';
                  imageSrc = `data:image/${format};base64,${image.base64}`;
                  
                  // Add compression info for user awareness
                  if (image.metadata) {
                    imageInfo = {
                      size: `${image.metadata.width}×${image.metadata.height}`,
                      fileSize: `${image.metadata.sizeKB.toFixed(1)}KB`,
                      quality: image.metadata.quality,
                      format: image.metadata.format,
                      compressed: image.metadata.originalWidth !== image.metadata.width || 
                                 image.metadata.originalHeight !== image.metadata.height
                    };
                    
                    if (imageInfo.compressed) {
                      imageAlt = `Compressed image (${image.metadata.originalWidth}×${image.metadata.originalHeight} → ${imageInfo.size})`;
                    }
                  }
                } else {
                  // Fallback for unknown format
                  console.warn('Unknown image format:', image);
                  console.warn('Image object:', image);
                  console.warn('Image type:', typeof image);
                  console.warn('Image constructor:', image?.constructor?.name);
                  return (
                    <div key={imgIndex} className="rounded-lg overflow-hidden">
                      <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>Unable to display image (unsupported format)</span>
                        </div>
                        {process.env.NODE_ENV === 'development' && (
                          <div className="mt-1 text-xs font-mono">
                            Type: {typeof image}, Constructor: {image?.constructor?.name || 'unknown'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={imgIndex} className="rounded-lg overflow-hidden">
                    <img
                      src={imageSrc}
                      alt={imageAlt}
                      className="max-w-full h-auto rounded-lg border border-smortr-border/50"
                      style={{ maxHeight: '300px' }}
                    />
                    
                    {/* Compression info badge */}
                    {imageInfo && imageInfo.compressed && (
                      <div className="text-xs text-smortr-text-secondary mt-1 px-2 py-1 bg-smortr-hover rounded">
                        <div className="flex items-center space-x-2">
                          <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>Optimized: {imageInfo.size}, {imageInfo.fileSize}, {Math.round(imageInfo.quality * 100)}% quality</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Message content with markdown formatting */}
          {content && (
            <MarkdownMessage content={content} isUser={isUser} />
          )}
          
          {/* Debug info for image context (development only) */}
          {process.env.NODE_ENV === 'development' && message._imageDebugInfo && (
            <div className="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
              <div className="font-mono">
                🖼️ Images: {message._imageDebugInfo.imageCount} | Session: {message._imageDebugInfo.sessionId}
              </div>
            </div>
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
              <div className="bg-smortr-card text-smortr-text rounded-xl px-4 py-3 mr-2 border border-smortr-border max-w-[90%]">
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