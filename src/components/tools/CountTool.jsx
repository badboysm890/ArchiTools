import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fabric } from 'fabric';
import { FaSearchPlus, FaSearchMinus, FaExpandArrowsAlt } from 'react-icons/fa';
import { updateToolSettings } from '../../store/slices/toolsSlice';
import canvasService from '../../services/canvasService';

const CountTool = ({ file, scale = 1 }) => {
  const dispatch = useDispatch();
  const { toolSettings } = useSelector(state => state.tools);
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const [markings, setMarkings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  
  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitToScreen, setFitToScreen] = useState(true);

  // Get settings from Redux with fallbacks
  const countSettings = toolSettings?.count || {
    brushSize: 3,
    brushColor: '#22c55e',
    captureMode: 'visible'
  };
  const { brushSize, brushColor, captureMode } = countSettings;

  // Register canvas with canvas service
  useEffect(() => {
    const canvasId = 'count-tool-canvas';
    
    // Create a ref object that the canvas service expects
    const canvasRefForService = {
      current: null
    };
    
    // Update the ref when fabricRef changes
    const updateCanvasRef = () => {
      if (fabricRef.current?.upperCanvasEl) {
        // Use the upper canvas element from Fabric.js which contains all the drawings
        canvasRefForService.current = fabricRef.current.upperCanvasEl;
      } else if (fabricRef.current?.lowerCanvasEl) {
        // Fallback to lower canvas if upper is not available
        canvasRefForService.current = fabricRef.current.lowerCanvasEl;
      }
    };

    // Register with canvas service
    canvasService.registerCanvas(canvasId, canvasRefForService);
    
    // Update ref when canvas is initialized
    if (canvasInitialized) {
      updateCanvasRef();
    }

    return () => {
      canvasService.unregisterCanvas(canvasId);
    };
  }, [canvasInitialized]);

  // Create a custom capture method for the Count Tool that includes markings
  useEffect(() => {
    if (canvasInitialized && fabricRef.current) {
      // Override the canvas service capture for our specific canvas
      const originalCaptureCanvas = canvasService.captureCanvas.bind(canvasService);
      
      // Store the original method if we haven't already
      if (!canvasService._originalCaptureCanvas) {
        canvasService._originalCaptureCanvas = originalCaptureCanvas;
      }
      
      canvasService.captureCanvas = async (id, options = {}) => {
        if (id === 'count-tool-canvas' && fabricRef.current) {
          const canvas = fabricRef.current;
          
          // Use Fabric's built-in toDataURL which captures exactly what's visible
          // including current zoom/pan state and all markings
          const dataUrl = canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1 // Use current resolution to capture exactly what user sees
          });
          
          // Convert data URL to base64
          const base64 = dataUrl.split(',')[1];
          
          // Create an image to get actual dimensions
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = dataUrl;
          });
          
          return {
            base64: base64,
            metadata: {
              width: img.width,
              height: img.height,
              originalWidth: canvas.width,
              originalHeight: canvas.height,
              sizeKB: Math.round(base64.length * 0.75 / 1024), // Rough estimate
              format: 'png',
              quality: 1,
              captureMode: options.captureMode || 'viewport',
              toolType: 'count',
              markingCount: markings.length,
              zoomLevel: canvas.getZoom(),
              hasBackgroundImage: !!backgroundImage
            }
          };
        } else {
          // Use original method for other canvases
          return canvasService._originalCaptureCanvas(id, options);
        }
      };
    }

    return () => {
      // Restore original method when component unmounts
      if (canvasService._originalCaptureCanvas) {
        canvasService.captureCanvas = canvasService._originalCaptureCanvas;
      }
    };
  }, [canvasInitialized, backgroundImage, markings.length]);

  // Handle path creation event
  const handlePathCreated = (event) => {
    const path = event.path;
    path.set({
      stroke: brushColor,
      strokeWidth: brushSize,
      fill: 'transparent',
      selectable: false
    });
    
    setMarkings(prev => [...prev, {
      id: Date.now(),
      path: path,
      timestamp: new Date().toISOString()
    }]);
    
    if (fabricRef.current) {
      fabricRef.current.renderAll();
    }
  };

  // Convert PDF to image using PDF.js
  const convertPdfToImage = async (fileUrl) => {
    try {
      setIsPdfLoading(true);
      
      // Check if PDF.js is available
      if (!window.pdfjsLib) {
        throw new Error('PDF.js not loaded');
      }

      // Fetch the PDF file
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1); // Get first page
      
      // Use higher scale for better quality
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      // Convert canvas to data URL
      const imageUrl = canvas.toDataURL('image/png');
      return imageUrl;
      
    } catch (error) {
      console.error('Failed to convert PDF to image:', error);
      throw error;
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Check if file is a PDF
  const isPdfFile = (file) => {
    if (!file?.url && !file?.name) return false;
    
    // Check by file extension
    const fileName = file.name || file.url;
    const hasPdfExtension = fileName.toLowerCase().includes('.pdf');
    
    // Check by MIME type if available
    const hasPdfMimeType = file.type && file.type === 'pdf';
    
    return hasPdfExtension || hasPdfMimeType;
  };

  // Check if file is an image
  const isImageFile = (file) => {
    if (!file?.url && !file?.name) return false;
    
    // Check by file extension
    const fileName = file.name || file.url;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => 
      fileName.toLowerCase().includes(ext)
    );
    
    // Check by MIME type if available
    const hasImageMimeType = file.type && file.type.startsWith('image/');
    
    return hasImageExtension || hasImageMimeType;
  };

  // Wait for container to be ready
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerReady(true);
        } else {
          setTimeout(() => {
            if (containerRef.current) {
              const retryRect = containerRef.current.getBoundingClientRect();
              if (retryRect.width > 0 && retryRect.height > 0) {
                setContainerReady(true);
              }
            }
          }, 250);
        }
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, []);

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current || !canvasInitialized) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && fabricRef.current) {
          const containerWidth = Math.max(width - 32, 400);
          const containerHeight = Math.max(height - 32, 300);
          
          try {
            fabricRef.current.setDimensions({
              width: containerWidth,
              height: containerHeight
            });
            updateCanvasViewport();
          } catch (error) {
            console.warn('Error resizing canvas:', error);
          }
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [canvasInitialized]);

  // Initialize canvas with proper dimensions
  useLayoutEffect(() => {
    if (!canvasRef.current || !containerRef.current || !containerReady) {
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    if (containerRect.width <= 0 || containerRect.height <= 0) {
      console.warn('Container dimensions are invalid:', containerRect);
      return;
    }
    
    const containerWidth = Math.max(containerRect.width - 32, 400);
    const containerHeight = Math.max(containerRect.height - 32, 300);

    try {
      if (fabricRef.current) {
        fabricRef.current.dispose();
      }

      fabricRef.current = new fabric.Canvas(canvasRef.current, {
        selection: false,
        isDrawingMode: true,
        width: containerWidth,
        height: containerHeight
      });

      const canvas = fabricRef.current;

      // Configure the drawing brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = brushColor;

      // Event listeners for drawing
      canvas.on('path:created', handlePathCreated);

      // Add mouse wheel zoom support
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;
        
        setZoomLevel(zoom);
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Add pan support with Alt key
      canvas.on('mouse:down', (opt) => {
        const evt = opt.e;
        if (evt.altKey === true) {
          setIsDragging(true);
          canvas.selection = false;
          canvas.isDrawingMode = false;
          setDragStart({ x: evt.clientX, y: evt.clientY });
        }
      });

      canvas.on('mouse:move', (opt) => {
        if (isDragging) {
          const e = opt.e;
          const vpt = canvas.viewportTransform;
          vpt[4] += e.clientX - dragStart.x;
          vpt[5] += e.clientY - dragStart.y;
          canvas.requestRenderAll();
          setDragStart({ x: e.clientX, y: e.clientY });
        }
      });

      canvas.on('mouse:up', () => {
        if (isDragging) {
          setIsDragging(false);
          canvas.isDrawingMode = true;
          canvas.selection = false;
        }
      });

      setCanvasInitialized(true);

    } catch (error) {
      console.error('Failed to initialize canvas:', error);
      setCanvasInitialized(false);
    }

    return () => {
      if (fabricRef.current) {
        try {
          fabricRef.current.dispose();
          fabricRef.current = null;
        } catch (error) {
          console.warn('Error disposing canvas:', error);
        }
      }
      setCanvasInitialized(false);
    };
  }, [containerReady]);

  // Update brush settings when they change
  useEffect(() => {
    if (canvasInitialized && fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.width = brushSize;
      fabricRef.current.freeDrawingBrush.color = brushColor;
    }
  }, [brushSize, brushColor, canvasInitialized]);

  // Update canvas viewport
  const updateCanvasViewport = () => {
    if (!fabricRef.current || !backgroundImage) return;
    
    const canvas = fabricRef.current;
    canvas.setZoom(zoomLevel);
    canvas.viewportTransform[4] = panOffset.x;
    canvas.viewportTransform[5] = panOffset.y;
    canvas.requestRenderAll();
  };

  // Fit image to screen
  const fitImageToScreen = (img) => {
    if (!containerRef.current || !img || !fabricRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;
    
    const containerRatio = containerWidth / containerHeight;
    const imageRatio = img.width / img.height;
    
    let newZoom;
    if (containerRatio > imageRatio) {
      newZoom = containerHeight / img.height;
    } else {
      newZoom = containerWidth / img.width;
    }
    
    newZoom *= 0.9; // Add some padding
    
    setZoomLevel(newZoom);
    setPanOffset({
      x: (containerWidth - img.width * newZoom) / 2,
      y: (containerHeight - img.height * newZoom) / 2
    });
    
    const canvas = fabricRef.current;
    canvas.setZoom(newZoom);
    canvas.viewportTransform[4] = (containerWidth - img.width * newZoom) / 2;
    canvas.viewportTransform[5] = (containerHeight - img.height * newZoom) / 2;
    canvas.requestRenderAll();
  };

  // Load and display file (image or PDF)
  useEffect(() => {
    if (!canvasInitialized || !fabricRef.current) return;

    const canvas = fabricRef.current;
    setBackgroundImage(null);

    const loadBackgroundImage = async () => {
      try {
        let imageUrl = null;

        if (file?.url) {
          if (isPdfFile(file)) {
            // Convert PDF to image
            imageUrl = await convertPdfToImage(file.url);
          } else if (isImageFile(file)) {
            // Use image directly
            imageUrl = file.url;
          }
        }

        if (imageUrl) {
          fabric.Image.fromURL(
            imageUrl,
            (img) => {
              if (img && img.width && img.height && canvas) {
                setBackgroundImage(img);
                
                // Set background image
                canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                  originX: 'left',
                  originY: 'top'
                });

                // Fit to screen if enabled
                if (fitToScreen) {
                  fitImageToScreen(img);
                }
              } else {
                console.warn('Image loaded but dimensions are invalid');
                canvas.renderAll();
              }
            },
            {
              crossOrigin: 'anonymous'
            },
            (error) => {
              console.warn('Failed to load image:', error);
              canvas.renderAll();
            }
          );
        } else {
          canvas.renderAll();
        }
      } catch (error) {
        console.error('Failed to load background:', error);
        canvas.renderAll();
      }
    };

    loadBackgroundImage();
  }, [file, canvasInitialized, fitToScreen]);

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.2, 20);
    setZoomLevel(newZoom);
    if (fabricRef.current) {
      fabricRef.current.setZoom(newZoom);
      fabricRef.current.requestRenderAll();
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.2, 0.01);
    setZoomLevel(newZoom);
    if (fabricRef.current) {
      fabricRef.current.setZoom(newZoom);
      fabricRef.current.requestRenderAll();
    }
  };

  const handleFitToScreen = () => {
    if (backgroundImage) {
      fitImageToScreen(backgroundImage);
    }
  };

  const clearMarkings = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // Remove all drawn paths but keep background
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.type === 'path') {
        canvas.remove(obj);
      }
    });
    
    setMarkings([]);
    canvas.renderAll();
  };

  const undoLastMarking = () => {
    if (markings.length === 0) return;
    
    const canvas = fabricRef.current;
    const objects = canvas.getObjects();
    
    // Find and remove the last path object
    for (let i = objects.length - 1; i >= 0; i--) {
      if (objects[i].type === 'path') {
        canvas.remove(objects[i]);
        break;
      }
    }
    
    setMarkings(prev => prev.slice(0, -1));
    canvas.renderAll();
  };

  // Generate count prompt when markings are made
  const generateCountPrompt = () => {
    if (markings.length === 0) return '';
    
    const prompt = `Count how many occurrences of the items I have marked/circled in ${brushColor === '#22c55e' ? 'green' : 'colored'} markings are visible in this ${captureMode === 'visible' ? 'visible area of the' : 'entire'} drawing. I have made ${markings.length} marking(s) to help identify what to count. Please provide a detailed count and explain what you're counting.`;
    
    // Dispatch action to set this prompt in chat input
    window.dispatchEvent(new CustomEvent('setCountPrompt', { 
      detail: { prompt, hasMarkings: markings.length > 0 } 
    }));
    
    return prompt;
  };

  // Check if whole file mode is selected and show warning
  const isWholeFileMode = captureMode === 'whole';
  const currentFileIsImage = isImageFile(file);
  const currentFileIsPdf = isPdfFile(file);
  const hasValidFile = currentFileIsImage || currentFileIsPdf;

  return (
    <div className="h-full flex">
      <div className="flex-1 relative min-h-0">
        {isWholeFileMode && (
          <div className="absolute top-4 left-4 z-10 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Whole file support isn't ready - dev is tired! 😴</span>
            </div>
            <p className="text-sm mt-1">Switch to visible canvas mode to use the count tool.</p>
          </div>
        )}

        {/* Zoom Controls */}
        {canvasInitialized && hasValidFile && !isWholeFileMode && (
          <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm border border-smortr-border rounded-lg shadow-lg p-2 flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-smortr-text hover:bg-smortr-hover rounded transition-colors"
              title="Zoom Out"
            >
              <FaSearchMinus />
            </button>
            <span className="text-sm text-smortr-text-secondary min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-smortr-text hover:bg-smortr-hover rounded transition-colors"
              title="Zoom In"
            >
              <FaSearchPlus />
            </button>
            <button
              onClick={handleFitToScreen}
              className="p-2 text-smortr-text hover:bg-smortr-hover rounded transition-colors"
              title="Fit to Screen"
            >
              <FaExpandArrowsAlt />
            </button>
          </div>
        )}

        <div 
          ref={containerRef}
          className={`w-full h-full relative ${isWholeFileMode ? 'pointer-events-none opacity-50' : ''}`}
          style={{ minHeight: '400px', minWidth: '600px' }}
        >
          {/* Canvas container */}
          <div className="absolute inset-4 flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              className={`border border-smortr-border rounded-lg shadow-sm bg-white ${canvasInitialized ? 'opacity-100' : 'opacity-0'}`}
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
          
          {/* Loading states */}
          {isPdfLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-smortr-accent mb-3 mx-auto"></div>
                <p className="text-smortr-text-secondary">Converting PDF to image...</p>
              </div>
            </div>
          )}
          
          {!canvasInitialized && !isPdfLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-smortr-text-secondary">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-smortr-accent mb-3 mx-auto"></div>
                <p>Initializing canvas...</p>
              </div>
            </div>
          )}

          {/* Pan instructions */}
          {canvasInitialized && hasValidFile && !isWholeFileMode && (
            <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
              <p>Hold <kbd className="bg-white/20 px-1 rounded">Alt</kbd> + drag to pan</p>
              <p>Mouse wheel to zoom</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="w-64 bg-smortr-sidebar border-l border-smortr-border p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-smortr-text font-medium mb-2">Count Tool</h3>
            <p className="text-sm text-smortr-text-secondary mb-4">
              Draw around or mark items you want to count. The AI will analyze your markings.
            </p>
            
            {file && !hasValidFile && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-blue-800 font-medium">Unsupported file type</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Count tool works with image files (JPG, PNG, GIF, etc.) and PDF files. You can still draw markings on the blank canvas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentFileIsPdf && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-green-800 font-medium">PDF loaded</p>
                    <p className="text-xs text-green-600 mt-1">
                      First page converted to image for marking. Use zoom controls to get the perfect view.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-smortr-text font-medium mb-2">Markings</h4>
            <div className="space-y-2">
              {markings.length === 0 ? (
                <div className="text-sm text-smortr-text-secondary bg-smortr-hover rounded p-2">
                  No markings yet. Start drawing to mark items for counting.
                </div>
              ) : (
                <div className="text-sm text-smortr-text bg-green-100 dark:bg-green-900/20 rounded p-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brushColor }}></div>
                    <span>{markings.length} marking(s) made</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasValidFile && (
            <div>
              <h4 className="text-smortr-text font-medium mb-2">View Controls</h4>
              <div className="space-y-2">
                <div className="text-sm text-smortr-text-secondary">
                  <p><strong>Zoom:</strong> {Math.round(zoomLevel * 100)}%</p>
                  <p className="text-xs mt-1">Use mouse wheel or controls to zoom</p>
                  <p className="text-xs">Hold Alt + drag to pan around</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-smortr-text font-medium mb-2">Actions</h4>
            <div className="space-y-2">
              <button
                onClick={generateCountPrompt}
                disabled={markings.length === 0 || isWholeFileMode}
                className={`w-full px-4 py-2 rounded transition-colors font-medium ${
                  markings.length > 0 && !isWholeFileMode
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-smortr-hover text-smortr-text-secondary cursor-not-allowed'
                }`}
              >
                Generate Count Prompt
              </button>
              
              <button
                onClick={undoLastMarking}
                disabled={markings.length === 0}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  markings.length > 0
                    ? 'bg-smortr-hover text-smortr-text hover:bg-smortr-hover/80'
                    : 'bg-smortr-hover text-smortr-text-secondary cursor-not-allowed'
                }`}
              >
                Undo Last Marking
              </button>
              
              <button
                onClick={clearMarkings}
                disabled={markings.length === 0}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  markings.length > 0
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-smortr-hover text-smortr-text-secondary cursor-not-allowed'
                }`}
              >
                Clear All Markings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountTool; 