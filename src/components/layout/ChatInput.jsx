import React, { useState, useRef, useEffect } from 'react';
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
    getImageStats,
    error
  } = useChat();

  // Get current files and UI state from Redux
  const { currentFile, comparisonFile } = useSelector(state => state.files);
  const { splitView, overlayView } = useSelector(state => state.ui);
  const { activeTool } = useSelector(state => state.tools);

  const [message, setMessage] = useState('');
  const [useDualModels, setUseDualModels] = useState(false);
  const [secondaryModel, setSecondaryModel] = useState('qwen-vl:7b');
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // Context selection for split view: 'left', 'right', 'both'
  const [chatContext, setChatContext] = useState('both');
  
  // Image capture mode: 'visible' (current viewport) or 'whole' (entire file)
  const [captureMode, setCaptureMode] = useState('visible');

  // Count tool states
  const [countPrompt, setCountPrompt] = useState('');
  const [hasCountMarkings, setHasCountMarkings] = useState(false);
  const [shouldGlowSend, setShouldGlowSend] = useState(false);

  // Listen for count prompt events from CountTool
  useEffect(() => {
    const handleCountPrompt = (event) => {
      const { prompt, hasMarkings } = event.detail;
      setCountPrompt(prompt);
      setHasCountMarkings(hasMarkings);
      setMessage(prompt);
      setShouldGlowSend(hasMarkings);
      
      // Auto-fade the glow after 3 seconds
      if (hasMarkings) {
        setTimeout(() => setShouldGlowSend(false), 3000);
      }
    };

    window.addEventListener('setCountPrompt', handleCountPrompt);
    return () => window.removeEventListener('setCountPrompt', handleCountPrompt);
  }, []);

  // Clear count states when switching away from count tool
  useEffect(() => {
    if (activeTool !== 'count') {
      setCountPrompt('');
      setHasCountMarkings(false);
      setShouldGlowSend(false);
    }
  }, [activeTool]);
  
  // Get available canvases
  const hasCanvases = canvasService.hasAvailableCanvases();
  const availableCanvases = canvasService.getAvailableCanvases();

  // Get compression statistics for display
  const getCompressionStats = () => {
    if (!hasCanvases) return null;
    return canvasService.getCompressionStats();
  };

  // Get image context statistics
  const imageStats = getImageStats();

  const compressionStats = getCompressionStats();

  // Determine what context we're chatting about
  const getChatContext = () => {
    const hasMainDrawing = currentFile && (currentFile.type === 'image' || currentFile.type === 'pdf');
    const hasCompDrawing = comparisonFile && (comparisonFile.type === 'image' || comparisonFile.type === 'pdf');
    const isInSplitMode = (splitView || overlayView) && hasMainDrawing && hasCompDrawing;

    return {
      hasMainDrawing,
      hasCompDrawing,
      isInSplitMode,
      canChat: hasMainDrawing || hasCompDrawing,
      contextLabel: isInSplitMode 
        ? `${currentFile.name} | ${comparisonFile.name}`
        : hasMainDrawing 
          ? currentFile.name 
          : hasCompDrawing 
            ? comparisonFile.name 
            : null
    };
  };

  // Get images to send based on current context
  const getContextImages = async () => {
    const context = getChatContext();
    const images = [];

    // If Count Tool is active, prioritize its canvas
    if (activeTool === 'count') {
      const countCanvas = availableCanvases.find(c => c.id === 'count-tool-canvas');
      if (countCanvas) {
        try {
          const captureResult = await canvasService.captureCanvas('count-tool-canvas', {
            targetType: 'architectural',
            useCompression: true,
            modelId: selectedModel,
            captureMode: captureMode
          });
          images.push(captureResult);
          return images; // Return early when using Count Tool
        } catch (error) {
          console.error('Failed to capture count tool canvas:', error);
          // Fall through to regular capture logic if count tool fails
        }
      }
    }

    if (context.isInSplitMode) {
      // In split view, decide based on chatContext setting
      if (chatContext === 'left' || chatContext === 'both') {
        if (hasCanvases) {
          const mainCanvas = availableCanvases.find(c => c.id.includes('main'));
          if (mainCanvas) {
            try {
              const captureResult = await canvasService.captureCanvas(mainCanvas.id, {
                targetType: 'architectural',
                useCompression: true,
                modelId: selectedModel,
                captureMode: captureMode
              });
              images.push(captureResult);
            } catch (error) {
              console.error('Failed to capture main canvas:', error);
            }
          }
        } else if (currentFile) {
          if (captureMode === 'whole') {
            const wholeFileResult = await canvasService.captureWholeFile(currentFile);
            images.push(wholeFileResult);
          } else {
            images.push(currentFile.url);
          }
        }
      }
      
      if (chatContext === 'right' || chatContext === 'both') {
        if (hasCanvases) {
          const compCanvas = availableCanvases.find(c => c.id.includes('comparison'));
          if (compCanvas) {
            try {
              const captureResult = await canvasService.captureCanvas(compCanvas.id, {
                targetType: 'architectural',
                useCompression: true,
                modelId: selectedModel,
                captureMode: captureMode
              });
              images.push(captureResult);
            } catch (error) {
              console.error('Failed to capture comparison canvas:', error);
            }
          }
        } else if (comparisonFile) {
          if (captureMode === 'whole') {
            const wholeFileResult = await canvasService.captureWholeFile(comparisonFile);
            images.push(wholeFileResult);
          } else {
            images.push(comparisonFile.url);
          }
        }
      }
    } else {
      // Single view, use whatever is available
      if (hasCanvases) {
        try {
          const captures = await canvasService.captureAllCanvases({
            targetType: 'architectural',
            useCompression: true,
            modelId: selectedModel,
            captureMode: captureMode
          });
          images.push(...captures);
        } catch (error) {
          console.error('Failed to capture canvases:', error);
        }
      } else if (context.hasMainDrawing) {
        if (captureMode === 'whole') {
          const wholeFileResult = await canvasService.captureWholeFile(currentFile);
          images.push(wholeFileResult);
        } else {
          images.push(currentFile.url);
        }
      } else if (context.hasCompDrawing) {
        if (captureMode === 'whole') {
          const wholeFileResult = await canvasService.captureWholeFile(comparisonFile);
          images.push(wholeFileResult);
        } else {
          images.push(comparisonFile.url);
        }
      }
    }

    return images;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const context = getChatContext();
    
    if (!message.trim() && !hasCanvases) {
      return;
    }

    // Show loading state early
    setMessage('');
    
    try {
      const imagesToSend = await getContextImages();
      
      // Create contextual message prefix
      let contextPrefix = '';
      if (context.isInSplitMode) {
        if (chatContext === 'left') {
          contextPrefix = `[Analyzing: ${currentFile.name}] `;
        } else if (chatContext === 'right') {
          contextPrefix = `[Analyzing: ${comparisonFile.name}] `;
        } else if (chatContext === 'both') {
          contextPrefix = `[Comparing: ${currentFile.name} vs ${comparisonFile.name}] `;
        }
      } else if (context.hasMainDrawing) {
        contextPrefix = `[Analyzing: ${currentFile.name}] `;
      } else if (context.hasCompDrawing) {
        contextPrefix = `[Analyzing: ${comparisonFile.name}] `;
      }

      const textToSend = message.trim() || (imagesToSend.length > 0 ? 'Analyze this architectural drawing.' : '');
      const fullMessage = contextPrefix + textToSend;
      
      if (useDualModels && context.isInSplitMode && availableCanvases.length >= 2) {
        // Send to both models with different canvas images
        const canvas1 = availableCanvases.find(c => c.id.includes('main'));
        const canvas2 = availableCanvases.find(c => c.id.includes('comparison'));
        
        if (canvas1 && canvas2) {
          const image1Result = await canvasService.captureCanvas(canvas1.id, {
            targetType: 'architectural',
            useCompression: true,
            modelId: selectedModel,
            captureMode: captureMode
          });
          const image2Result = await canvasService.captureCanvas(canvas2.id, {
            targetType: 'architectural', 
            useCompression: true,
            modelId: secondaryModel,
            captureMode: captureMode
          });
          
          // Send to primary model with first canvas
          await sendMessage(`[Model 1: ${getModelDisplayName(selectedModel)}] ${textToSend}`, [image1Result]);
          
          // Send to secondary model with second canvas
          await sendMessage(`[Model 2: ${getModelDisplayName(secondaryModel)}] ${textToSend}`, [image2Result], secondaryModel);
        }
      } else {
        // Single model send
        await sendMessage(fullMessage, imagesToSend);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessage(message); // Restore message on error
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const context = getChatContext();

  return (
    <div className="bg-smortr-sidebar border-t border-smortr-border">
      {/* Context Bar - Shows what we're chatting about */}
      <div className="px-4 py-2 border-b border-smortr-border bg-smortr-hover/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-smortr-accent rounded-full"></div>
              <span className="text-sm font-medium text-smortr-text">
                {context.canChat ? 'Chatting about:' : 'No drawing open'}
              </span>
            </div>
            
            {context.canChat && (
              <div className="flex items-center space-x-2">
                {context.isInSplitMode ? (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setChatContext('left')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        chatContext === 'left' 
                          ? 'bg-smortr-accent text-white' 
                          : 'bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover'
                      }`}
                    >
                      {currentFile.name}
                    </button>
                    <button
                      onClick={() => setChatContext('right')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        chatContext === 'right' 
                          ? 'bg-smortr-accent text-white' 
                          : 'bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover'
                      }`}
                    >
                      {comparisonFile.name}
                    </button>
                    <button
                      onClick={() => setChatContext('both')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        chatContext === 'both' 
                          ? 'bg-smortr-accent text-white' 
                          : 'bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover'
                      }`}
                    >
                      Compare Both
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-smortr-text font-medium">
                    {context.contextLabel}
                  </span>
                )}
                
                {/* Capture Mode Toggle */}
                <div className="flex items-center space-x-1 ml-4 pl-4 border-l border-smortr-border">
                  <span className="text-xs text-smortr-text-secondary">Capture:</span>
                  <button
                    onClick={() => setCaptureMode('visible')}
                    className={`px-2 py-1 rounded text-xs transition-colors flex items-center space-x-1 ${
                      captureMode === 'visible' 
                        ? 'bg-smortr-accent text-white' 
                        : 'bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover'
                    }`}
                    title="Capture only what's visible in the current viewport"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    <span>Visible</span>
                  </button>
                  <button
                    onClick={() => setCaptureMode('whole')}
                    className={`px-2 py-1 rounded text-xs transition-colors flex items-center space-x-1 ${
                      captureMode === 'whole' 
                        ? 'bg-smortr-accent text-white' 
                        : 'bg-smortr-card text-smortr-text-secondary hover:bg-smortr-hover'
                    }`}
                    title="Capture the entire file/document as an image"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    <span>Whole File</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
            {/* Image Context Statistics */}
            {imageStats && imageStats.session.imageCount > 0 && (
              <div className="flex items-center space-x-2 text-xs text-smortr-text-secondary">
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  <span>{imageStats.session.imageCount} cached</span>
                </div>
                {imageStats.global.totalImages > imageStats.session.imageCount && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    📊 Smart referencing active
                  </div>
                )}
              </div>
            )}
          
          {!context.canChat && (
            <span className="text-xs text-smortr-text-secondary">
              Open a drawing to start chatting
            </span>
          )}
        </div>
      </div>

      {/* Main Input Area */}
      <form onSubmit={handleSubmit} className="p-4">
        {/* Model Selection and Dual Model Toggle */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Model Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-smortr-card border border-smortr-border rounded-lg hover:bg-smortr-hover transition-colors text-sm"
              >
                <span className="text-smortr-text font-medium">
                  {getModelDisplayName(selectedModel)}
                </span>
                <svg className="w-4 h-4 text-smortr-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showModelSelector && (
                <div className="absolute bottom-full mb-2 left-0 w-48 bg-smortr-card border border-smortr-border rounded-lg shadow-lg py-1 z-10">
                  {availableModels.map(model => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        setSelectedModel(model);
                        setShowModelSelector(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-smortr-hover transition-colors ${
                        selectedModel === model ? 'bg-smortr-accent text-white' : 'text-smortr-text'
                      }`}
                    >
                      {getModelDisplayName(model)}
                      {!isImageSupported() && model === selectedModel && (
                        <span className="text-xs opacity-75 block">Text only</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dual Model Toggle (only in split view) */}
            {context.isInSplitMode && availableCanvases.length >= 2 && (
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={useDualModels}
                  onChange={(e) => setUseDualModels(e.target.checked)}
                  className="rounded border-smortr-border text-smortr-accent focus:ring-smortr-accent focus:ring-offset-0"
                />
                <span className="text-smortr-text-secondary">Compare models</span>
              </label>
            )}
          </div>

          {/* Status Indicators */}
          <div className="flex items-center space-x-2">
            {error && (
              <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded border border-red-200">
                ⚠️ {error}
              </div>
            )}
            
            {compressionStats && compressionStats.needingCompression > 0 && (
              <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                ⚡ Compressing {compressionStats.needingCompression} images
              </div>
            )}
            
            {captureMode === 'whole' && context.canChat && (
              <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                📄 Whole file capture enabled
              </div>
            )}
            
            {hasCanvases && (
              <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                📷 Canvas ready
              </div>
            )}
          </div>
        </div>

        {/* Secondary Model Selector (when dual models enabled) */}
        {useDualModels && (
          <div className="mb-3 p-3 bg-smortr-hover/50 rounded-lg border border-smortr-border">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-smortr-text-secondary">Secondary model:</span>
              <select
                value={secondaryModel}
                onChange={(e) => setSecondaryModel(e.target.value)}
                className="px-3 py-1 bg-smortr-card border border-smortr-border rounded text-sm text-smortr-text focus:outline-none focus:ring-2 focus:ring-smortr-accent"
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>
                    {getModelDisplayName(model)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Input Field */}
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                context.canChat 
                  ? hasCanvases 
                    ? "Ask about the architectural drawing or just press Enter to analyze..."
                    : `Ask about ${context.contextLabel}...`
                  : "Open a drawing file to start chatting..."
              }
              disabled={!context.canChat || isLoading}
              className="w-full px-4 py-3 bg-smortr-card border border-smortr-border rounded-xl text-smortr-text placeholder-smortr-text-secondary focus:outline-none focus:ring-2 focus:ring-smortr-accent focus:border-transparent resize-none"
              rows={1}
              style={{
                minHeight: '44px',
                maxHeight: '120px',
                overflowY: 'auto'
              }}
            />
          </div>
          
          {/* Send Button */}
          <button
            type="submit"
            disabled={(!message.trim() && !hasCanvases) || isLoading || !context.canChat}
            className={`px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
              (!message.trim() && !hasCanvases) || isLoading || !context.canChat
                ? 'bg-smortr-border text-smortr-text-secondary cursor-not-allowed'
                : shouldGlowSend
                  ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/50 animate-pulse'
                  : 'bg-smortr-accent text-white hover:bg-smortr-accent/90'
            }`}
          >
            {isStreaming ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Stop</span>
              </>
            ) : isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>{activeTool === 'count' && hasCountMarkings ? 'Count Items' : 'Send'}</span>
              </>
            )}
          </button>
          
          {/* Cancel Button (when streaming) */}
          {isStreaming && (
            <button
              type="button"
              onClick={cancelStream}
              className="px-3 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
              title="Cancel stream"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ChatInput;