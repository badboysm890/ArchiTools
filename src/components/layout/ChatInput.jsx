import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useChat } from '../../hooks/useChat';
import canvasService from '../../services/canvasService';

const ChatInput = () => {
  const {
    sendMessage,
    isLoading,
    isStreaming,
    cancelStream,
    selectedModel,
    setSelectedModel,
    availableModels,
    getModelDisplayName,
    isImageSupported,
    error
  } = useChat();

  // Get current preview images from files state
  const { currentFile, comparisonFile } = useSelector(state => state.files);

  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [useCanvasImages, setUseCanvasImages] = useState(false);
  const [useDualModels, setUseDualModels] = useState(false);
  const [secondaryModel, setSecondaryModel] = useState('qwen3:0.6b');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const fileInputRef = useRef(null);

  // Get preview images
  const getPreviewImages = () => {
    const images = [];
    if (currentFile && currentFile.type === 'image') {
      images.push(currentFile.url);
    }
    if (comparisonFile && comparisonFile.type === 'image') {
      images.push(comparisonFile.url);
    }
    return images;
  };

  // Get canvas images
  const getCanvasImages = () => {
    try {
      const captures = canvasService.captureAllCanvases();
      return captures.map(capture => capture.base64);
    } catch (error) {
      console.error('Failed to capture canvas images:', error);
      return [];
    }
  };

  const previewImages = getPreviewImages();
  const hasPreviewImages = previewImages.length > 0;
  const hasCanvases = canvasService.hasAvailableCanvases();
  const availableCanvases = canvasService.getAvailableCanvases();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let imagesToSend = [];
    
    if (useCanvasImages && hasCanvases) {
      imagesToSend = getCanvasImages();
    } else if (selectedImages.length > 0) {
      imagesToSend = selectedImages;
    }
    
    if (!message.trim() && imagesToSend.length === 0) {
      return;
    }

    const textToSend = message.trim() || (imagesToSend.length > 0 ? 'Describe this image.' : '');
    
    try {
      if (useDualModels && hasCanvases && availableCanvases.length >= 2) {
        // Send to both models with different canvas images
        const canvas1 = availableCanvases[0];
        const canvas2 = availableCanvases[1];
        
        const image1Base64 = canvasService.captureCanvas(canvas1.id);
        const image2Base64 = canvasService.captureCanvas(canvas2.id);
        
        // Send to primary model with first canvas
        await sendMessage(`[Model 1: ${getModelDisplayName(selectedModel)}] ${textToSend}`, [image1Base64]);
        
        // Send to secondary model with second canvas
        await sendMessage(`[Model 2: ${getModelDisplayName(secondaryModel)}] ${textToSend}`, [image2Base64], secondaryModel);
      } else {
        // Single model send
        await sendMessage(textToSend, imagesToSend);
      }
      
      setMessage('');
      setSelectedImages([]);
      setUseCanvasImages(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...imageFiles]);
      setUseCanvasImages(false); // Clear canvas images when manually selecting
      
      // Auto-switch to image-capable model if needed
      if (!isImageSupported()) {
        setSelectedModel('gemma3:4b');
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCanvasToggle = () => {
    const newUseCanvasImages = !useCanvasImages;
    setUseCanvasImages(newUseCanvasImages);
    
    if (newUseCanvasImages) {
      setSelectedImages([]); // Clear manual images when enabling canvas
      // Auto-switch to image-capable model if needed
      if (!isImageSupported()) {
        setSelectedModel('gemma3:4b');
      }
    }
  };

  const canSendImages = isImageSupported() || selectedImages.length > 0 || useCanvasImages;
  const currentImages = useCanvasImages ? getCanvasImages() : selectedImages;

  return (
    <div className="bg-smortr-sidebar border-t border-smortr-border">
      {/* Model Selector Bar */}
      <div className="px-4 py-2 border-b border-smortr-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Primary Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-smortr-card rounded-lg border border-smortr-border hover:bg-smortr-hover transition-colors"
              >
                <div className="w-2 h-2 bg-smortr-accent rounded-full"></div>
                <span className="text-sm font-medium text-smortr-text">
                  {getModelDisplayName(selectedModel)}
                </span>
                <svg className="w-4 h-4 text-smortr-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showModelSelector && (
                <div className="absolute bottom-full mb-2 w-64 bg-smortr-card border border-smortr-border rounded-lg shadow-smortr-lg z-50">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-smortr-text-secondary mb-2 px-2">Select Primary Model</div>
                    {availableModels.map((model) => (
                      <button
                        key={model}
                        onClick={() => {
                          setSelectedModel(model);
                          setShowModelSelector(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-smortr-hover transition-colors ${
                          selectedModel === model ? 'bg-smortr-accent text-white' : 'text-smortr-text'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{getModelDisplayName(model)}</span>
                          {selectedModel === model && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        {model === 'gemma3:4b' && (
                          <div className="text-xs text-smortr-text-secondary mt-1">Supports images</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dual Model Toggle */}
            {hasCanvases && availableCanvases.length >= 2 && (
              <>
                <button
                  onClick={() => setUseDualModels(!useDualModels)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors text-sm ${
                    useDualModels
                      ? 'border-blue-500 bg-blue-500/20 text-blue-500 hover:bg-blue-500/30'
                      : 'border-smortr-border bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover'
                  }`}
                  title="Use two models for split screen comparison"
                >
                  Dual Models
                </button>

                {/* Secondary Model Selector */}
                {useDualModels && (
                  <select
                    value={secondaryModel}
                    onChange={(e) => setSecondaryModel(e.target.value)}
                    className="px-3 py-1.5 bg-smortr-card border border-smortr-border rounded-lg text-sm text-smortr-text"
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {getModelDisplayName(model)}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center space-x-2">
            {isStreaming && (
              <button
                onClick={cancelStream}
                className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 transition-colors"
              >
                Stop
              </button>
            )}
            
            {error && (
              <div className="text-xs text-red-400 max-w-xs truncate" title={error}>
                Error: {error}
              </div>
            )}
            
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
          </div>
        </div>
      </div>

      {/* Canvas/Images Preview */}
      {(useCanvasImages || currentImages.length > 0) && (
        <div className="px-4 py-2 border-b border-smortr-border">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-semibold text-smortr-text-secondary">
              {useCanvasImages ? 'Canvas Images:' : 'Selected Images:'}
            </span>
            {useCanvasImages && (
              <span className="text-xs text-green-400">
                Using canvas content ({availableCanvases.length} canvas{availableCanvases.length !== 1 ? 'es' : ''})
              </span>
            )}
            {useDualModels && (
              <span className="text-xs text-blue-400">Dual model mode enabled</span>
            )}
            {!canSendImages && (
              <span className="text-xs text-yellow-400">Switch to Gemma 3 for image support</span>
            )}
          </div>
          
          {useCanvasImages ? (
            <div className="flex space-x-2 overflow-x-auto">
              {availableCanvases.map((canvas, index) => (
                <div key={canvas.id} className="relative flex-shrink-0">
                  <div className="w-16 h-16 bg-smortr-hover rounded-lg border border-smortr-border flex items-center justify-center">
                    <svg className="w-8 h-8 text-smortr-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
                    🖼️
                  </div>
                  <div className="absolute -bottom-1 left-0 right-0 text-xs text-center text-smortr-text-secondary bg-smortr-bg rounded px-1">
                    {canvas.id.includes('main') ? 'Main' : 'Comp'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex space-x-2 overflow-x-auto">
              {currentImages.map((image, index) => (
                <div key={index} className="relative flex-shrink-0">
                  <img
                    src={typeof image === 'string' ? (image.startsWith('data:') ? image : `data:image/png;base64,${image}`) : URL.createObjectURL(image)}
                    alt={`Selected ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-smortr-border"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex space-x-3">
          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                useCanvasImages && hasCanvases
                  ? useDualModels 
                    ? "Compare these canvases with two models..."
                    : "Describe what you see in the canvas..."
                  : selectedImages.length > 0 
                    ? "Describe what you want to know about the image..." 
                    : "Ask a question..."
              }
              disabled={isLoading}
              className="w-full bg-smortr-bg text-smortr-text rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-smortr-accent border border-smortr-border placeholder-smortr-text-secondary resize-none"
              rows="1"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          {/* Canvas Toggle */}
          {hasCanvases && (
            <div className="flex items-center">
              <div className="flex items-center space-x-2 px-3 py-2 bg-smortr-card rounded-lg border border-smortr-border">
                <svg className="w-4 h-4 text-smortr-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-smortr-text-secondary">Canvas</span>
                <button
                  type="button"
                  onClick={handleCanvasToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-smortr-accent focus:ring-offset-2 ${
                    useCanvasImages ? 'bg-green-500' : 'bg-smortr-hover'
                  }`}
                  title={useCanvasImages ? 'Disable canvas images' : 'Enable canvas images'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useCanvasImages ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                {useCanvasImages && (
                  <span className="text-xs text-green-500 font-semibold">
                    {availableCanvases.length}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* File Upload Button (fallback when no canvas) */}
          {!hasCanvases && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-shrink-0 p-3 rounded-lg border border-smortr-border bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover transition-colors"
              title="Upload image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={isLoading || (!message.trim() && !useCanvasImages && selectedImages.length === 0)}
            className="flex-shrink-0 bg-smortr-accent text-white px-6 py-3 rounded-lg hover:bg-smortr-accent/90 focus:outline-none focus:ring-2 focus:ring-smortr-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
    </div>
  );
};

export default ChatInput; 