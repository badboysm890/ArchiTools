import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fabric } from 'fabric';
import { FaSearchPlus, FaSearchMinus, FaExpandArrowsAlt, FaCrop, FaCopy, FaDownload } from 'react-icons/fa';
import { updateToolSettings } from '../../store/slices/toolsSlice';
import canvasService from '../../services/canvasService';
import ocrService from '../../services/ocrService';

const ExtractTool = ({ file, scale = 1 }) => {
  const dispatch = useDispatch();
  const { toolSettings } = useSelector(state => state.tools);
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  
  // Use refs for values accessed in event handlers to avoid closure issues
  const isDrawingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startPointRef = useRef(null);
  const currentRectRef = useRef(null);
  const [extractedRegions, setExtractedRegions] = useState([]);
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
  
  // Tool state
  const [toolPanelExpanded, setToolPanelExpanded] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);

  // Get settings from Redux with fallbacks
  const extractSettings = toolSettings?.extract || {
    strokeColor: '#FF4444',
    strokeWidth: 2,
    fillOpacity: 0.1,
    captureMode: 'visible'
  };

  const { strokeColor, strokeWidth, fillOpacity, captureMode } = extractSettings;

  // Update settings helper
  const updateSettings = (newSettings) => {
    dispatch(updateToolSettings({
      tool: 'extract',
      settings: newSettings
    }));
  };

  // Check if file is a PDF
  const isPdfFile = (file) => {
    if (!file?.url && !file?.name) return false;
    const fileName = file.name || file.url;
    const hasPdfExtension = fileName.toLowerCase().includes('.pdf');
    const hasPdfMimeType = file.type && file.type === 'pdf';
    return hasPdfExtension || hasPdfMimeType;
  };

  // Check if file is an image
  const isImageFile = (file) => {
    if (!file?.url && !file?.name) return false;
    const fileName = file.name || file.url;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => 
      fileName.toLowerCase().includes(ext)
    );
    const hasImageMimeType = file.type && file.type.startsWith('image/');
    return hasImageExtension || hasImageMimeType;
  };

  // Convert PDF to image using PDF.js
  const convertPdfToImage = async (fileUrl) => {
    try {
      setIsPdfLoading(true);
      
      if (!window.pdfjsLib) {
        throw new Error('PDF.js not loaded');
      }

      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0,
        cMapPacked: true
      }).promise;
      const page = await pdf.getPage(1);
      
      const baseScale = 2.0; // Reasonable scale for display and OCR
      const viewport = page.getViewport({ scale: baseScale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Optimize for text extraction
      context.imageSmoothingEnabled = false;
      context.textRenderingOptimization = 'optimizeSpeed';
      
      await page.render({ 
        canvasContext: context, 
        viewport: viewport,
        renderInteractiveForms: false,
        intent: 'print'
      }).promise;
      
      // Enhance contrast for better OCR
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const contrastFactor = 1.4;
      const brightnessFactor = 15;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, contrastFactor * (data[i] - 128) + 128 + brightnessFactor));
        data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (data[i + 1] - 128) + 128 + brightnessFactor));
        data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (data[i + 2] - 128) + 128 + brightnessFactor));
      }
      
      context.putImageData(imageData, 0, 0);
      const imageUrl = canvas.toDataURL('image/png', 1.0);
      
      console.log(`PDF converted for extraction: ${viewport.width}x${viewport.height} at ${baseScale}x scale`);
      return imageUrl;
      
    } catch (error) {
      console.error('Failed to convert PDF to image:', error);
      throw error;
    } finally {
      setIsPdfLoading(false);
    }
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
        isDrawingMode: false,
        width: containerWidth,
        height: containerHeight,
        renderOnAddRemove: true,
        skipTargetFind: false,
        imageSmoothingEnabled: false,
        preserveObjectStacking: true,
        allowTouchScrolling: false,
        interactive: true,
        moveCursor: 'crosshair',
        hoverCursor: 'crosshair'
      });
      
      console.log('🎨 Canvas initialized with dimensions:', { width: containerWidth, height: containerHeight });

      const canvas = fabricRef.current;
      
      // Optimize canvas for high-quality rendering
      const ctx = canvas.getContext();
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.oImageSmoothingEnabled = false;
      }

      // Mouse event handlers for rectangle drawing
      canvas.on('mouse:down', (opt) => {
        const pointer = canvas.getPointer(opt.e);
        console.log('🖱️ Mouse down at:', pointer);
        
        if (opt.e.altKey) {
          // Handle panning
          console.log('🤚 Alt+drag detected - enabling pan mode');
          isDraggingRef.current = true;
          setIsDragging(true);
          canvas.selection = false;
          setDragStart({ x: opt.e.clientX, y: opt.e.clientY });
          return;
        }

        // Start drawing rectangle
        console.log('🎯 Starting rectangle drawing');
        isDrawingRef.current = true;
        startPointRef.current = pointer;
        setIsDrawing(true);
        setStartPoint(pointer);
        
        // Create rectangle
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: strokeColor,
          opacity: fillOpacity,
          selectable: false,
          evented: false,
          name: 'extractRect'
        });
        
        console.log('📦 Created rectangle at:', { x: pointer.x, y: pointer.y });
        currentRectRef.current = rect;
        setCurrentRect(rect);
        canvas.add(rect);
        canvas.renderAll();
      });

      canvas.on('mouse:move', (opt) => {
        if (isDraggingRef.current) {
          // Handle panning
          const e = opt.e;
          const vpt = canvas.viewportTransform;
          vpt[4] += e.clientX - dragStart.x;
          vpt[5] += e.clientY - dragStart.y;
          canvas.requestRenderAll();
          setDragStart({ x: e.clientX, y: e.clientY });
          return;
        }

        if (!isDrawingRef.current || !currentRectRef.current || !startPointRef.current) return;
        
        const pointer = canvas.getPointer(opt.e);
        const width = pointer.x - startPointRef.current.x;
        const height = pointer.y - startPointRef.current.y;
        
        currentRectRef.current.set({
          width: Math.abs(width),
          height: Math.abs(height),
          left: width < 0 ? pointer.x : startPointRef.current.x,
          top: height < 0 ? pointer.y : startPointRef.current.y
        });
        
        canvas.renderAll();
      });

      canvas.on('mouse:up', () => {
        console.log('🖱️ Mouse up - isDragging:', isDraggingRef.current, 'isDrawing:', isDrawingRef.current);
        
        if (isDraggingRef.current) {
          console.log('🤚 Ending pan mode');
          isDraggingRef.current = false;
          setIsDragging(false);
          canvas.selection = false;
          return;
        }

        if (isDrawingRef.current && currentRectRef.current) {
          console.log('🎯 Ending rectangle drawing');
          isDrawingRef.current = false;
          setIsDrawing(false);
          
          const rect = currentRectRef.current;
          console.log('📦 Final rectangle size:', { width: rect.width, height: rect.height });
          
          // Only keep rectangles that have meaningful size
          if (rect.width > 10 && rect.height > 10) {
            console.log('✅ Rectangle is large enough, adding to regions');
            // Make rectangle selectable and add to extracted regions
            rect.set({
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true
            });
            
            setExtractedRegions(prev => [...prev, {
              id: Date.now(),
              rect: rect,
              timestamp: new Date().toISOString(),
              extracted: false
            }]);
          } else {
            console.log('❌ Rectangle too small, removing');
            // Remove small rectangles
            canvas.remove(rect);
          }
          
          currentRectRef.current = null;
          startPointRef.current = null;
          setCurrentRect(null);
          setStartPoint(null);
        }
      });

      // Add mouse wheel zoom support
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        
        if (zoom > 20) zoom = 20;
        if (zoom < 0.1) zoom = 0.1;
        
        setZoomLevel(zoom);
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Debug: Test if any mouse events are being captured
      canvas.on('mouse:over', () => {
        console.log('👆 Mouse entered canvas area');
      });
      
      canvas.on('mouse:out', () => {
        console.log('👋 Mouse left canvas area');
      });

      console.log('✅ All canvas event handlers registered');
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
    
    newZoom *= 0.9; // Less aggressive padding
    const minZoom = 0.1; // Allow more zoom out
    const maxZoom = 5.0; // Allow more zoom in
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    
    setZoomLevel(newZoom);
    
    const offsetX = (containerWidth - img.width * newZoom) / 2;
    const offsetY = (containerHeight - img.height * newZoom) / 2;
    
    setPanOffset({ x: offsetX, y: offsetY });
    
    const canvas = fabricRef.current;
    canvas.setZoom(newZoom);
    canvas.viewportTransform[4] = offsetX;
    canvas.viewportTransform[5] = offsetY;
    canvas.requestRenderAll();
    
    console.log(`Image fitted to screen: zoom=${(newZoom * 100).toFixed(1)}%, size=${img.width}x${img.height}`);
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
            imageUrl = await convertPdfToImage(file.url);
          } else if (isImageFile(file)) {
            imageUrl = file.url;
          }
        }

        if (imageUrl) {
          fabric.Image.fromURL(
            imageUrl,
            (img) => {
              if (img && img.width && img.height && canvas) {
                setBackgroundImage(img);
                
                img.set({
                  opacity: 1.0,
                  brightness: 0,
                  contrast: 0,
                  saturation: 0,
                  originX: 'left',
                  originY: 'top',
                  selectable: false,
                  evented: false,
                  name: 'backgroundImage'
                });
                
                img.set({
                  left: 0,
                  top: 0,
                  selectable: false,
                  evented: false,
                  hoverCursor: 'crosshair',
                  moveCursor: 'crosshair'
                });
                
                console.log('🖼️ Background image configured:', {
                  selectable: img.selectable,
                  evented: img.evented,
                  dimensions: { width: img.width, height: img.height }
                });
                
                canvas.clear();
                canvas.add(img);
                canvas.renderAll();
                
                console.log('✅ Background image added to canvas');
                console.log('📊 Canvas status after image load:', {
                  objectCount: canvas.getObjects().length,
                  canvasReady: canvas.isReady,
                  interactive: canvas.interactive
                });

                if (fitToScreen) {
                  setTimeout(() => {
                    fitImageToScreen(img);
                  }, 50);
                }
                
                console.log(`Background image loaded: ${img.width}x${img.height} pixels`);
              } else {
                console.warn('Image loaded but dimensions are invalid');
                canvas.renderAll();
              }
            },
            {
              crossOrigin: 'anonymous'
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
    const newZoom = Math.max(zoomLevel / 1.2, 0.1);
    setZoomLevel(newZoom);
    if (fabricRef.current) {
      fabricRef.current.setZoom(newZoom);
      fabricRef.current.requestRenderAll();
    }
  };

  const handleFitToScreen = () => {
    if (backgroundImage && fabricRef.current) {
      const canvas = fabricRef.current;
      const bgObj = canvas.getObjects().find(obj => obj.name === 'backgroundImage');
      if (bgObj) {
        fitImageToScreen(bgObj);
      }
    }
  };

  // Extract content from selected rectangles
  const extractContent = async (region) => {
    if (!region.rect || !fabricRef.current || !backgroundImage) {
      console.error('Cannot extract: missing required components');
      return;
    }

    setIsExtracting(true);
    
    try {
      const canvas = fabricRef.current;
      const rect = region.rect;
      
      // Get the current viewport transform
      const zoom = canvas.getZoom();
      const vpt = canvas.viewportTransform;
      
      // Calculate the actual coordinates in the background image
      const rectLeft = (rect.left - vpt[4]) / zoom;
      const rectTop = (rect.top - vpt[5]) / zoom;
      const rectWidth = rect.width / zoom;
      const rectHeight = rect.height / zoom;
      
      // Create a temporary canvas to extract the region
      const extractCanvas = document.createElement('canvas');
      const extractCtx = extractCanvas.getContext('2d');
      
      extractCanvas.width = rectWidth;
      extractCanvas.height = rectHeight;
      
      // Find the background image object
      const bgObj = canvas.getObjects().find(obj => obj.name === 'backgroundImage');
      if (!bgObj) {
        throw new Error('Background image not found');
      }
      
      // Draw the cropped region
      extractCtx.drawImage(
        bgObj.getElement(),
        rectLeft, rectTop, rectWidth, rectHeight,
        0, 0, rectWidth, rectHeight
      );
      
      // Convert to base64 for OCR
      const extractedDataUrl = extractCanvas.toDataURL('image/png');
      const base64Data = extractedDataUrl.split(',')[1];
      
      console.log(`Extracted region: ${rectWidth}x${rectHeight} pixels`);
      
      // Process the extracted image with OCR
      const ocrResult = await processOCR(extractedDataUrl);
      
      // Update the region with extraction results
      setExtractedRegions(prev => 
        prev.map(r => 
          r.id === region.id 
            ? { 
                ...r, 
                extracted: true, 
                content: ocrResult.content,
                tableData: ocrResult.tableData,
                confidence: ocrResult.confidence,
                hasTable: ocrResult.hasTable,
                extractedImage: extractedDataUrl,
                error: ocrResult.error
              }
            : r
        )
      );
      
      setExtractionResult({
        content: ocrResult.content,
        tableData: ocrResult.tableData,
        confidence: ocrResult.confidence,
        hasTable: ocrResult.hasTable,
        image: extractedDataUrl,
        error: ocrResult.error
      });
      
    } catch (error) {
      console.error('Failed to extract content:', error);
      alert('Failed to extract content: ' + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  // Initialize OCR service
  useEffect(() => {
    ocrService.initialize().catch(error => {
      console.warn('OCR service initialization failed:', error);
    });
    
    return () => {
      // Cleanup on unmount
      ocrService.cleanup();
    };
  }, []);

  // Process OCR extraction
  const processOCR = async (imageDataUrl) => {
    try {
      console.log('Starting OCR processing...');
      
      // Extract text and detect tables using OCR service
      const ocrResult = await ocrService.extractText(imageDataUrl, {
        preprocessImage: true,
        detectTables: true,
        language: 'eng'
      });
      
      console.log('OCR completed:', ocrResult);
      
      // Format results
      const content = ocrResult.text || 'No text detected';
      let tableData = null;
      
      // Check if tables were detected
      if (ocrResult.tables && ocrResult.tables.length > 0) {
        // Use the first (best) detected table
        const bestTable = ocrResult.tables.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        tableData = bestTable.data;
        console.log(`Table detected with ${bestTable.rows} rows and ${bestTable.columns} columns`);
      }
      
      return {
        content,
        tableData,
        confidence: ocrResult.confidence,
        hasTable: tableData !== null
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      
      // Fallback to basic extraction
      return {
        content: 'OCR processing failed. Please try again or check the image quality.',
        tableData: null,
        confidence: 0,
        hasTable: false,
        error: error.message
      };
    }
  };

  // Copy content to clipboard
  const copyToClipboard = async (content, tableData = null) => {
    try {
      if (tableData && Array.isArray(tableData)) {
        // Use OCR service formatting for better compatibility
        const tsvContent = ocrService.formatTableForClipboard(tableData);
        
        await navigator.clipboard.writeText(tsvContent);
        console.log('Table data copied to clipboard as TSV');
        alert('Table data copied to clipboard! You can paste it into Excel or Google Sheets.');
      } else {
        await navigator.clipboard.writeText(content);
        console.log('Text content copied to clipboard');
        alert('Content copied to clipboard!');
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      // Fallback: create a temporary text area
      const textArea = document.createElement('textarea');
      textArea.value = tableData 
        ? ocrService.formatTableForClipboard(tableData)
        : content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      alert('Content copied to clipboard!');
    }
  };

  // Clear all rectangles
  const clearRectangles = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    const objects = canvas.getObjects();
    
    objects.forEach(obj => {
      if (obj.name === 'extractRect') {
        canvas.remove(obj);
      }
    });
    
    setExtractedRegions([]);
    setExtractionResult(null);
    canvas.renderAll();
  };

  // Check if whole file mode is selected and show warning
  const isWholeFileMode = captureMode === 'whole';
  const currentFileIsImage = isImageFile(file);
  const currentFileIsPdf = isPdfFile(file);
  const hasValidFile = currentFileIsImage || currentFileIsPdf;

  return (
    <div className="h-full relative">
      {/* Main canvas area - full screen */}
      <div className="w-full h-full relative">
        {isWholeFileMode && (
          <div className="absolute top-4 left-4 z-10 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Whole file support isn't ready - dev is tired! 😴</span>
            </div>
            <p className="text-sm mt-1">Switch to visible canvas mode to use the extract tool.</p>
          </div>
        )}

        {/* Zoom Controls */}
        {canvasInitialized && hasValidFile && !isWholeFileMode && (
          <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm border border-smortr-border rounded-lg shadow-lg p-2 flex items-center space-x-2">
            <button
              onClick={() => handleZoomOut()}
              className="p-2 text-smortr-text hover:bg-smortr-hover rounded transition-colors"
              title="Zoom Out"
            >
              <FaSearchMinus />
            </button>
            <span className="text-sm text-smortr-text-secondary min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => handleZoomIn()}
              className="p-2 text-smortr-text hover:bg-smortr-hover rounded transition-colors"
              title="Zoom In"
            >
              <FaSearchPlus />
            </button>
            <button
              onClick={() => handleFitToScreen()}
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
                <p className="text-smortr-text-secondary">Converting PDF for extraction...</p>
              </div>
            </div>
          )}
          
          {isExtracting && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-smortr-accent mb-3 mx-auto"></div>
                <p className="text-smortr-text-secondary">Extracting content...</p>
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

          {/* Usage instructions */}
          {canvasInitialized && hasValidFile && !isWholeFileMode && (
            <div className="absolute bottom-4 left-4 z-10 bg-black/80 text-white px-3 py-2 rounded-lg text-sm max-w-xs">
              <div className="font-medium mb-1">🎯 Extract Tool Instructions:</div>
              <p>• Click and drag to draw extraction rectangles</p>
              <p>• Click extract button to process selected areas</p>
              <p>• Hold <kbd className="bg-white/20 px-1 rounded">Alt</kbd> + drag to pan around</p>
              <p>• Use mouse wheel to zoom in/out</p>
              <p className="text-xs text-gray-300 mt-1">💡 Works best with clear text and tables</p>
            </div>
          )}
        </div>

        {/* Floating Extract Tool Panel */}
        <div className={`absolute top-4 left-4 z-20 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl transition-all duration-300 ${
          toolPanelExpanded ? 'w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto' : 'w-auto'
        }`}>
          {/* Panel Header - Always Visible */}
          <div className="p-3 border-b border-gray-600/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  canvasInitialized && hasValidFile ? 'bg-green-400' : 
                  canvasInitialized ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <h3 className="text-sm font-medium text-white">Extract Tool</h3>
                {extractedRegions.length > 0 && (
                  <span className="px-2 py-1 bg-red-600 text-red-100 text-xs rounded-full">
                    {extractedRegions.length}
                  </span>
                )}
                {currentFileIsPdf && (
                  <span className="px-2 py-1 bg-emerald-600 text-emerald-100 text-xs rounded-full" title="Enhanced PDF rendering active">
                    ✨ PDF
                  </span>
                )}
                {!canvasInitialized && (
                  <span className="px-2 py-1 bg-yellow-600 text-yellow-100 text-xs rounded-full">
                    Loading...
                  </span>
                )}
              </div>
              <button
                onClick={() => setToolPanelExpanded(!toolPanelExpanded)}
                className="p-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title={toolPanelExpanded ? 'Collapse panel' : 'Expand panel'}
              >
                <svg className={`w-4 h-4 transition-transform ${toolPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel Content - Expandable */}
          {toolPanelExpanded && (
            <div className="p-4 space-y-4">
              {/* Status messages */}
              {file && !hasValidFile && (
                <div className="p-3 bg-blue-900/40 border border-blue-600/50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-blue-300 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-xs text-blue-200 font-medium">Unsupported file type</p>
                      <p className="text-xs text-blue-300 mt-1">
                        Extract tool works with image/PDF files.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Regions */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Extracted Regions</h4>
                <div className="space-y-2">
                  {extractedRegions.length === 0 ? (
                    <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                      <p className="mb-1">No regions selected yet.</p>
                      <p className="text-xs text-gray-500">
                        💡 Click and drag on the image to create extraction rectangles
                      </p>
                      {!canvasInitialized && (
                        <p className="text-xs text-yellow-400 mt-1">⏳ Canvas initializing...</p>
                      )}
                      {!hasValidFile && (
                        <p className="text-xs text-red-400 mt-1">⚠️ Load an image or PDF first</p>
                      )}
                      {canvasInitialized && hasValidFile && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-blue-400">✅ Ready to draw!</p>
                          <p className="text-xs text-gray-500">
                            Open browser console for drawing debug info
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {extractedRegions.map((region, index) => (
                        <div key={region.id} className="text-xs bg-red-900/40 border border-red-600/50 rounded p-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-red-200">Region {index + 1}</span>
                            <div className="flex space-x-1">
                              {!region.extracted && (
                                <button
                                  onClick={() => extractContent(region)}
                                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-500"
                                  disabled={isExtracting}
                                >
                                  <FaCrop className="w-3 h-3" />
                                </button>
                              )}
                              {region.extracted && (
                                <>
                                  <button
                                    onClick={() => copyToClipboard(region.content, region.tableData)}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500"
                                  >
                                    <FaCopy className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {region.extracted && (
                            <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-green-300">Extracted content:</p>
                                {region.confidence && (
                                  <span className={`px-1 py-0.5 rounded text-xs ${
                                    region.confidence > 80 ? 'bg-green-600 text-green-100' :
                                    region.confidence > 60 ? 'bg-yellow-600 text-yellow-100' :
                                    'bg-red-600 text-red-100'
                                  }`}>
                                    {Math.round(region.confidence)}% confident
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-300 mb-1">{region.content}</p>
                              {region.hasTable && region.tableData && (
                                <div className="mt-2">
                                  <p className="text-blue-300 mb-1">
                                    📊 Table detected: {region.tableData.length} rows × {region.tableData[0]?.length || 0} columns
                                  </p>
                                </div>
                              )}
                              {region.error && (
                                <p className="text-red-300 mt-1">⚠️ {region.error}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  {/* Debug buttons for development */}
                  <div className="flex space-x-1">
                    <button
                      onClick={() => {
                        console.log('🔍 CANVAS DEBUG INFO:');
                        console.log('- Canvas initialized:', canvasInitialized);
                        console.log('- Fabric canvas exists:', !!fabricRef.current);
                        console.log('- Has valid file:', hasValidFile);
                        console.log('- Background image:', !!backgroundImage);
                        console.log('- Canvas objects:', fabricRef.current?.getObjects().length || 0);
                        console.log('- Current drawing state:', {
                          isDrawing: isDrawingRef.current,
                          isDragging: isDraggingRef.current,
                          hasStartPoint: !!startPointRef.current,
                          hasCurrentRect: !!currentRectRef.current
                        });
                        if (fabricRef.current) {
                          const canvas = fabricRef.current;
                          console.log('- Canvas dimensions:', { width: canvas.width, height: canvas.height });
                          console.log('- Zoom level:', canvas.getZoom());
                          console.log('- Viewport transform:', canvas.viewportTransform);
                        }
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded transition-colors font-medium bg-gray-600 text-white hover:bg-gray-500"
                    >
                      🔍 Debug
                    </button>
                    
                    <button
                      onClick={() => {
                        if (fabricRef.current) {
                          const testRect = new fabric.Rect({
                            left: 50,
                            top: 50,
                            width: 100,
                            height: 80,
                            stroke: strokeColor,
                            strokeWidth: strokeWidth,
                            fill: strokeColor,
                            opacity: fillOpacity,
                            selectable: true,
                            name: 'extractRect'
                          });
                          fabricRef.current.add(testRect);
                          fabricRef.current.renderAll();
                          setExtractedRegions(prev => [...prev, {
                            id: Date.now(),
                            rect: testRect,
                            timestamp: new Date().toISOString(),
                            extracted: false
                          }]);
                          console.log('✅ Test rectangle added successfully');
                        } else {
                          console.error('❌ Fabric canvas not available');
                        }
                      }}
                      className="flex-1 px-2 py-1 text-xs rounded transition-colors font-medium bg-blue-600 text-white hover:bg-blue-500"
                    >
                      🧪 Test
                    </button>
                  </div>
                  
                  <button
                    onClick={() => clearRectangles()}
                    disabled={extractedRegions.length === 0}
                    className={`w-full px-3 py-2 text-xs rounded transition-colors font-medium ${
                      extractedRegions.length > 0
                        ? 'bg-red-600 text-white hover:bg-red-500'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Clear All Rectangles
                  </button>
                </div>
              </div>

              {/* Latest Extraction Result */}
              {extractionResult && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Latest Extraction</h4>
                  <div className="bg-gray-800 rounded p-3 text-xs">
                    <p className="text-gray-300 mb-2">{extractionResult.content}</p>
                    {extractionResult.tableData && (
                      <div className="space-y-2">
                        <p className="text-blue-300">Table Data:</p>
                        <div className="bg-gray-900 rounded p-2 overflow-x-auto">
                          <table className="w-full text-xs">
                            <tbody>
                              {extractionResult.tableData.map((row, i) => (
                                <tr key={i}>
                                  {row.map((cell, j) => (
                                    <td key={j} className="border border-gray-600 px-1 py-0.5 text-gray-300">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          onClick={() => copyToClipboard(extractionResult.content, extractionResult.tableData)}
                          className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 flex items-center justify-center space-x-1"
                        >
                          <FaCopy className="w-3 h-3" />
                          <span>Copy Table to Clipboard</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExtractTool;