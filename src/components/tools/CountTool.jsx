import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fabric } from 'fabric';
import { FaSearchPlus, FaSearchMinus, FaExpandArrowsAlt, FaGripHorizontal } from 'react-icons/fa';
import { updateToolSettings } from '../../store/slices/toolsSlice';
import canvasService from '../../services/canvasService';
import gridAnnotationService from '../../services/gridAnnotationService';

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

  // Grid state
  const [gridEnabled, setGridEnabled] = useState(false);
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [gridCellMarkings, setGridCellMarkings] = useState({}); // Track which cells have markings
  const [gridOverlay, setGridOverlay] = useState(null);
  const [highlightedCells, setHighlightedCells] = useState([]); // Cells highlighted from chat responses
  const [highlightTimeout, setHighlightTimeout] = useState(null);
  
  // UI state
  const [toolPanelExpanded, setToolPanelExpanded] = useState(false);

  // Get settings from Redux with fallbacks
  const countSettings = toolSettings?.count || {
    brushSize: 3,
    brushColor: '#22c55e',
    captureMode: 'visible'
  };
  const { brushSize, brushColor, captureMode } = countSettings;

  // Preserve current viewport state
  const preserveViewportState = () => {
    if (!fabricRef.current) return null;
    
    const canvas = fabricRef.current;
    return {
      transform: canvas.viewportTransform.slice(),
      zoom: canvas.getZoom()
    };
  };

  // Restore viewport state
  const restoreViewportState = (viewportState) => {
    if (!fabricRef.current || !viewportState) return;
    
    const canvas = fabricRef.current;
    const currentTransform = canvas.viewportTransform.slice();
    const currentZoom = canvas.getZoom();
    
    canvas.viewportTransform = viewportState.transform;
    canvas.setZoom(viewportState.zoom);
    
    console.log('📍 VIEWPORT RESTORED:');
    console.log('   From: [' + currentTransform.map(v => v.toFixed(2)).join(', ') + '], zoom: ' + currentZoom.toFixed(2));
    console.log('   To:   [' + viewportState.transform.map(v => v.toFixed(2)).join(', ') + '], zoom: ' + viewportState.zoom.toFixed(2));
  };

  // Handle grid cell highlighting from chat responses
  const handleCellHighlight = (cellIds) => {
    console.log('🎯 COUNT TOOL: Highlighting cells from chat:', cellIds);
    
    // Clear any existing timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    
    // Simply ensure grid is enabled and highlight the cells
    setGridEnabled(true);
    setHighlightedCells(cellIds);
    
    // Force immediate grid creation and highlighting
    setTimeout(() => {
      if (fabricRef.current) {
        const currentViewport = preserveViewportState();
        drawGrid(cellIds);
        restoreViewportState(currentViewport);
        console.log('✅ COUNT TOOL: Cells highlighted successfully');
      }
    }, 50);

    // Auto-clear highlight after 10 seconds
    const timeout = setTimeout(() => {
      console.log('⏰ COUNT TOOL: Auto-clearing highlights - preserving current viewport');
      
      // Preserve viewport before clearing highlights
      const clearViewport = preserveViewportState();
      
      setHighlightedCells([]);
      
      // Redraw grid without highlights, preserving current viewport
      setTimeout(() => {
        if (fabricRef.current && (gridEnabled || gridOverlay)) {
          console.log('🔄 Redrawing grid after highlight clear - maintaining viewport position');
          drawGrid();
          
          // Restore viewport after redraw
          restoreViewportState(clearViewport);
        }
      }, 100);
    }, 10000);
    
    setHighlightTimeout(timeout);
  };

  // Register canvas with canvas service and grid annotation service
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
      
      // Clear highlight timeout
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
      }
    };
  }, [canvasInitialized, highlightTimeout]);

  // Separate effect for grid annotation service subscription (always active)
  useEffect(() => {
    console.log('🔗 COUNT TOOL: Subscribing to grid annotation service for cell click highlighting');
    gridAnnotationService.subscribe('count-tool', handleCellHighlight);

    return () => {
      console.log('🔌 COUNT TOOL: Unsubscribing from grid annotation service');
      gridAnnotationService.unsubscribe('count-tool');
    };
  }, []); // Empty dependency array - subscribe once and stay subscribed

  // Helper function to get grid cell from coordinates
  const getGridCellFromCoords = (x, y) => {
    if (!gridEnabled || !fabricRef.current) return null;
    
    const canvas = fabricRef.current;
    
    // Get current viewport transform
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate the visible area in canvas coordinates
    const viewportLeft = -vpt[4] / zoom;
    const viewportTop = -vpt[5] / zoom;
    const viewportWidth = canvasWidth / zoom;
    const viewportHeight = canvasHeight / zoom;
    
    const cellWidth = viewportWidth / gridCols;
    const cellHeight = viewportHeight / gridRows;
    
    // Convert coordinates relative to viewport
    const relativeX = x - viewportLeft;
    const relativeY = y - viewportTop;
    
    const col = Math.floor(relativeX / cellWidth);
    const row = Math.floor(relativeY / cellHeight);
    
    if (row >= 0 && row < gridRows && col >= 0 && col < gridCols) {
      return { row, col, cellId: row * gridCols + col + 1 };
    }
    
    return null;
  };

  // Draw grid overlay
  const drawGrid = (immediateHighlightCells = null) => {
    if (!fabricRef.current || !gridEnabled) {
      console.log('Cannot draw grid: canvas not ready or grid disabled');
      return;
    }
    
    const canvas = fabricRef.current;
    
    // Get the current viewport transform to position grid in visible area
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform.slice(); // Make a copy to avoid mutations
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate the visible area in canvas coordinates
    const viewportLeft = -vpt[4] / zoom;
    const viewportTop = -vpt[5] / zoom;
    const viewportWidth = canvasWidth / zoom;
    const viewportHeight = canvasHeight / zoom;
    
    console.log(`📍 VIEWPORT STATE: Drawing grid in viewport: ${viewportLeft.toFixed(1)},${viewportTop.toFixed(1)} ${viewportWidth.toFixed(1)}x${viewportHeight.toFixed(1)}, zoom: ${zoom.toFixed(2)}, grid: ${gridRows}x${gridCols}`);
    console.log(`📍 VIEWPORT TRANSFORM: [${vpt.map(v => v.toFixed(2)).join(', ')}]`);
    
    if (immediateHighlightCells && immediateHighlightCells.length > 0) {
      console.log(`✨ ELEGANT HIGHLIGHT: Drawing grid with highlighted cells:`, immediateHighlightCells);
      console.log(`   📍 Viewport position: (${viewportLeft.toFixed(1)}, ${viewportTop.toFixed(1)})`);
      console.log(`   📏 Cell dimensions: ${cellWidth.toFixed(1)} x ${cellHeight.toFixed(1)}`);
      console.log(`   🔍 Current zoom: ${zoom.toFixed(2)}x`);
      
      // Calculate where each highlighted cell should appear
      immediateHighlightCells.forEach(cellId => {
        const row = Math.floor((cellId - 1) / gridCols);
        const col = (cellId - 1) % gridCols;
        const expectedX = viewportLeft + col * cellWidth;
        const expectedY = viewportTop + row * cellHeight;
        console.log(`   🎯 Cell ${cellId} should be at: (${expectedX.toFixed(1)}, ${expectedY.toFixed(1)})`);
      });
    }
    
    // Remove existing grid more thoroughly
    if (gridOverlay) {
      try {
        canvas.remove(gridOverlay);
        console.log('Removed existing grid overlay');
      } catch (error) {
        console.warn('Error removing existing grid:', error);
      }
    }
    
    // Also remove any objects with name 'gridOverlay'
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.name === 'gridOverlay') {
        canvas.remove(obj);
      }
    });
    
    const gridGroup = new fabric.Group([], {
      selectable: false,
      evented: false,
      excludeFromExport: false,
      name: 'gridOverlay'
    });
    
    // Use viewport dimensions for grid sizing
    const cellWidth = viewportWidth / gridCols;
    const cellHeight = viewportHeight / gridRows;
    
    // Draw outer border with elegant styling - positioned in viewport
    const border = new fabric.Rect({
      left: viewportLeft,
      top: viewportTop,
      width: viewportWidth,
      height: viewportHeight,
      fill: 'transparent',
      stroke: 'rgba(99, 102, 241, 0.8)', // Elegant indigo with transparency
      strokeWidth: Math.max(2 / zoom, 1), // Refined line width with minimum
      selectable: false,
      evented: false,
      excludeFromExport: false,
      shadow: new fabric.Shadow({
        color: 'rgba(99, 102, 241, 0.3)',
        blur: 4 / zoom,
        offsetX: 0,
        offsetY: 0
      })
    });
    gridGroup.addWithUpdate(border);
    
    // Draw vertical grid lines with elegant styling
    for (let i = 1; i < gridCols; i++) {
      const x = viewportLeft + i * cellWidth;
      const line = new fabric.Line([x, viewportTop, x, viewportTop + viewportHeight], {
        stroke: 'rgba(148, 163, 184, 0.6)', // Elegant slate gray with transparency
        strokeWidth: Math.max(1.5 / zoom, 0.5), // Thinner, more refined lines
        strokeDashArray: [8 / zoom, 4 / zoom], // Subtle dash pattern
        selectable: false,
        evented: false,
        excludeFromExport: false
      });
      gridGroup.addWithUpdate(line);
    }
    
    // Draw horizontal grid lines with elegant styling
    for (let i = 1; i < gridRows; i++) {
      const y = viewportTop + i * cellHeight;
      const line = new fabric.Line([viewportLeft, y, viewportLeft + viewportWidth, y], {
        stroke: 'rgba(148, 163, 184, 0.6)', // Elegant slate gray with transparency
        strokeWidth: Math.max(1.5 / zoom, 0.5), // Thinner, more refined lines
        strokeDashArray: [8 / zoom, 4 / zoom], // Subtle dash pattern
        selectable: false,
        evented: false,
        excludeFromExport: false
      });
      gridGroup.addWithUpdate(line);
    }
    
    // Add cell numbers and highlights
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellId = row * gridCols + col + 1;
        // Position cell numbers in viewport coordinates
        const x = viewportLeft + col * cellWidth + (15 / zoom); // Scale padding with zoom
        const y = viewportTop + row * cellHeight + (25 / zoom); // Scale padding with zoom
        
        // Check if this cell is highlighted from chat response
        const cellsToHighlight = immediateHighlightCells || highlightedCells;
        const isHighlighted = cellsToHighlight.includes(cellId);
        const hasMarkings = gridCellMarkings[cellId] > 0;
        
        // Determine colors based on state with elegant styling
        let fillColor, strokeColor, textColor, shadowConfig;
        
        if (isHighlighted) {
          // Highlighted cells get elegant purple with glow
          fillColor = 'rgba(139, 92, 246, 0.9)'; // Elegant purple
          strokeColor = 'rgba(124, 58, 237, 1.0)'; // Deeper purple border
          textColor = 'white';
          shadowConfig = new fabric.Shadow({
            color: 'rgba(139, 92, 246, 0.6)',
            blur: 8 / zoom,
            offsetX: 0,
            offsetY: 0
          });
        } else if (hasMarkings) {
          // Cells with markings get elegant emerald
          fillColor = 'rgba(52, 211, 153, 0.85)'; // Elegant emerald
          strokeColor = 'rgba(16, 185, 129, 1.0)'; // Deeper emerald border
          textColor = 'white';
          shadowConfig = new fabric.Shadow({
            color: 'rgba(52, 211, 153, 0.4)',
            blur: 6 / zoom,
            offsetX: 0,
            offsetY: 0
          });
        } else {
          // Default cells get elegant slate with subtle transparency
          fillColor = 'rgba(71, 85, 105, 0.75)'; // Elegant slate
          strokeColor = 'rgba(51, 65, 85, 0.9)'; // Deeper slate border
          textColor = 'white';
          shadowConfig = new fabric.Shadow({
            color: 'rgba(0, 0, 0, 0.3)',
            blur: 4 / zoom,
            offsetX: 1 / zoom,
            offsetY: 1 / zoom
          });
        }
        
        // Add elegant highlight overlay for highlighted cells
        if (isHighlighted) {
          console.log(`🟨 Adding elegant highlight overlay for cell ${cellId} at viewport position`);
          
          // Create an elegant, glowing highlight overlay
          const highlight = new fabric.Rect({
            left: viewportLeft + col * cellWidth,
            top: viewportTop + row * cellHeight,
            width: cellWidth,
            height: cellHeight,
            fill: 'rgba(139, 92, 246, 0.15)', // Subtle purple fill
            stroke: 'rgba(139, 92, 246, 0.8)', // Purple border
            strokeWidth: Math.max(3 / zoom, 1.5), // Refined border width
            strokeDashArray: [12 / zoom, 6 / zoom], // Elegant dash pattern
            selectable: false,
            evented: false,
            excludeFromExport: false,
            shadow: new fabric.Shadow({
              color: 'rgba(139, 92, 246, 0.4)',
              blur: 12 / zoom,
              offsetX: 0,
              offsetY: 0
            })
          });
          gridGroup.addWithUpdate(highlight);
          
          console.log(`   - Highlight positioned at: ${viewportLeft + col * cellWidth}, ${viewportTop + row * cellHeight}`);
          console.log(`   - Highlight size: ${cellWidth} x ${cellHeight}`);
        }
        
        // Elegant background circle for number - scaled with zoom
        const circleRadius = Math.max(16 / zoom, 10); // Refined circle size
        const circleX = x;
        const circleY = y - (6 / zoom); // Adjusted vertical position
        
        const circle = new fabric.Circle({
          left: circleX,
          top: circleY,
          radius: circleRadius,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: Math.max((isHighlighted ? 2.5 : 1.5) / zoom, 0.8), // Refined stroke width
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: true, // Make clickable
          excludeFromExport: false,
          cellId: cellId, // Store cell ID for click handling
          hoverCursor: 'pointer',
          moveCursor: 'pointer',
          shadow: shadowConfig // Apply elegant shadow
        });
        
        // Elegant number text with refined typography - scaled with zoom
        const fontSize = Math.max(13 / zoom, 9); // Refined font size
        const text = new fabric.Text(cellId.toString(), {
          left: circleX,
          top: circleY,
          fontSize: fontSize,
          fill: textColor,
          fontWeight: '600', // Semi-bold for better readability
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', // Modern font stack
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: true, // Make clickable
          excludeFromExport: false,
          cellId: cellId, // Store cell ID for click handling
          hoverCursor: 'pointer',
          moveCursor: 'pointer',
          shadow: new fabric.Shadow({
            color: 'rgba(0, 0, 0, 0.3)',
            blur: 2 / zoom,
            offsetX: 0.5 / zoom,
            offsetY: 0.5 / zoom
          })
        });
        
        gridGroup.addWithUpdate(circle);
        gridGroup.addWithUpdate(text);
      }
    }
    
    // Store current viewport state before any manipulations
    const currentViewportTransform = canvas.viewportTransform.slice();
    const currentZoom = canvas.getZoom();
    
    setGridOverlay(gridGroup);
    canvas.add(gridGroup);
    
    // Keep grid on top so it's visible over the background image
    canvas.bringToFront(gridGroup);
    
    // Ensure viewport hasn't changed during grid operations
    canvas.viewportTransform = currentViewportTransform;
    canvas.setZoom(currentZoom);
    
    canvas.renderAll();
    
    console.log(`🎯 Grid overlay added with ${gridGroup.getObjects().length} objects`);
    console.log(`📊 Canvas now has ${canvas.getObjects().length} total objects`);
    console.log(`📍 VIEWPORT PRESERVED: Transform maintained at [${currentViewportTransform.map(v => v.toFixed(2)).join(', ')}]`);
    
    // Log all objects for debugging
    const allObjects = canvas.getObjects();
    allObjects.forEach((obj, index) => {
      console.log(`   ${index}: ${obj.type || 'unknown'} (${obj.name || 'unnamed'})`);
    });
    
    // Force another render after a short delay to ensure visibility
    setTimeout(() => {
      if (canvas && gridGroup) {
        console.log('🔄 Forcing grid to front (delayed) with viewport preservation...');
        
        // Store viewport again before final operations
        const delayedViewportTransform = canvas.viewportTransform.slice();
        const delayedZoom = canvas.getZoom();
        
        canvas.bringToFront(gridGroup);
        
        // Restore viewport after bringing grid to front
        canvas.viewportTransform = delayedViewportTransform;
        canvas.setZoom(delayedZoom);
        
        canvas.renderAll();
        
        // Final verification
        const finalObjects = canvas.getObjects();
        const finalGridIndex = finalObjects.indexOf(gridGroup);
        console.log(`✅ Final grid position: ${finalGridIndex} of ${finalObjects.length} objects`);
        console.log(`📍 FINAL VIEWPORT: [${canvas.viewportTransform.map(v => v.toFixed(2)).join(', ')}]`);
        
        if (finalGridIndex === finalObjects.length - 1) {
          console.log('🎉 Grid is now on top with viewport preserved!');
        } else {
          console.warn('⚠️ Grid is not on top, something is covering it');
        }
      }
    }, 100);
  };

  // Update grid when settings change
  useEffect(() => {
    if (canvasInitialized) {
      if (gridEnabled) {
        console.log('🔄 Grid settings changed, redrawing with viewport preservation...');
        const viewportBeforeSettingsRedraw = preserveViewportState();
        drawGrid();
        // Ensure settings change doesn't move viewport
        setTimeout(() => {
          restoreViewportState(viewportBeforeSettingsRedraw);
        }, 50);
      } else if (gridOverlay) {
        console.log('🔄 Grid disabled, removing overlay with viewport preservation...');
        const viewportBeforeRemoval = preserveViewportState();
        fabricRef.current.remove(gridOverlay);
        setGridOverlay(null);
        fabricRef.current.renderAll();
        // Ensure grid removal doesn't move viewport
        restoreViewportState(viewportBeforeRemoval);
      }
    }
  }, [gridEnabled, gridRows, gridCols, canvasInitialized, highlightedCells, gridCellMarkings]);

  // Periodic grid visibility check (fallback)
  useEffect(() => {
    if (!gridEnabled || !canvasInitialized) return;
    
    const interval = setInterval(() => {
      if (fabricRef.current && gridOverlay) {
        const objects = fabricRef.current.getObjects();
        const gridIndex = objects.indexOf(gridOverlay);
        
        // If grid is not found, redraw it
        if (gridIndex === -1) {
          console.log('🔄 Grid overlay missing, redrawing with viewport preservation...');
          const viewportBeforePeriodicRedraw = preserveViewportState();
          drawGrid();
          // Ensure periodic redraw doesn't move viewport
          restoreViewportState(viewportBeforePeriodicRedraw);
        }
      }
    }, 5000); // Check every 5 seconds (less frequent since we now redraw on viewport changes)
    
    return () => clearInterval(interval);
  }, [gridEnabled, canvasInitialized, gridOverlay]);

  // Create a custom capture method for the Count Tool that includes markings and grid
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
              hasBackgroundImage: !!backgroundImage,
              // Grid metadata
              gridEnabled: gridEnabled,
              gridRows: gridEnabled ? gridRows : null,
              gridCols: gridEnabled ? gridCols : null,
              gridCellMarkings: gridEnabled ? gridCellMarkings : null,
              gridCellsWithContent: gridEnabled ? Object.keys(gridCellMarkings).filter(cellId => gridCellMarkings[cellId] > 0) : []
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
  }, [canvasInitialized, backgroundImage, markings.length, gridEnabled, gridRows, gridCols, gridCellMarkings]);

  // Handle path creation event
  const handlePathCreated = (event) => {
    const path = event.path;
    path.set({
      stroke: brushColor,
      strokeWidth: brushSize,
      fill: 'transparent',
      selectable: false
    });
    
    // Track grid cell if grid is enabled
    let gridCell = null;
    if (gridEnabled && path.path && path.path.length > 0) {
      // Get the center point of the path for grid cell detection
      const pathBounds = path.getBoundingRect();
      const centerX = pathBounds.left + pathBounds.width / 2;
      const centerY = pathBounds.top + pathBounds.height / 2;
      
      gridCell = getGridCellFromCoords(centerX, centerY);
      
      if (gridCell) {
        setGridCellMarkings(prev => ({
          ...prev,
          [gridCell.cellId]: (prev[gridCell.cellId] || 0) + 1
        }));
      }
    }
    
    setMarkings(prev => [...prev, {
      id: Date.now(),
      path: path,
      timestamp: new Date().toISOString(),
      gridCell: gridCell
    }]);
    
    if (fabricRef.current) {
      fabricRef.current.renderAll();
    }
  };

  // Convert PDF to image using PDF.js with high quality rendering
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
      const pdf = await window.pdfjsLib.getDocument({ 
        data: arrayBuffer,
        // Improve PDF parsing for architectural drawings
        verbosity: 0,
        cMapPacked: true
      }).promise;
      const page = await pdf.getPage(1); // Get first page
      
      // Use much higher scale for architectural drawings with fine details
      const baseScale = 4.0; // Increased from 2.0 for better quality
      const viewport = page.getViewport({ scale: baseScale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas size
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Optimize canvas rendering for crisp lines
      context.imageSmoothingEnabled = false; // Disable smoothing for sharp lines
      context.textRenderingOptimization = 'optimizeSpeed';
      
      // Render with high quality settings
      await page.render({ 
        canvasContext: context, 
        viewport: viewport,
        // Enhanced rendering options
        renderInteractiveForms: false,
        intent: 'print' // Use print quality instead of display
      }).promise;
      
      // Enhance contrast for better visibility
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Apply contrast enhancement for architectural drawings
      const contrastFactor = 1.3; // Increase contrast
      const brightnessFactor = 10; // Slight brightness boost
      
      for (let i = 0; i < data.length; i += 4) {
        // Apply contrast and brightness to RGB channels
        data[i] = Math.min(255, Math.max(0, contrastFactor * (data[i] - 128) + 128 + brightnessFactor));     // Red
        data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (data[i + 1] - 128) + 128 + brightnessFactor)); // Green
        data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (data[i + 2] - 128) + 128 + brightnessFactor)); // Blue
        // Alpha channel (data[i + 3]) remains unchanged
      }
      
      // Put the enhanced image data back
      context.putImageData(imageData, 0, 0);
      
      // Convert canvas to data URL with maximum quality
      const imageUrl = canvas.toDataURL('image/png', 1.0);
      
      console.log(`PDF converted to image: ${viewport.width}x${viewport.height} at ${baseScale}x scale`);
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
            
            // Redraw grid after canvas resize to match new dimensions
            if (gridEnabled) {
              setTimeout(() => {
                console.log('🔄 Redrawing grid after canvas resize...');
                drawGrid();
              }, 100);
            }
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
        height: containerHeight,
        // Enhanced rendering settings for better PDF display
        renderOnAddRemove: true,
        skipTargetFind: false,
        imageSmoothingEnabled: false, // Crisp rendering for technical drawings
        preserveObjectStacking: true
      });

      const canvas = fabricRef.current;
      
      // Optimize canvas for high-quality rendering
      const ctx = canvas.getContext();
      if (ctx) {
        ctx.imageSmoothingEnabled = false; // Disable smoothing for sharp lines
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.oImageSmoothingEnabled = false;
      }

      // Configure the drawing brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = brushSize;
      canvas.freeDrawingBrush.color = brushColor;

      // Event listeners for drawing
      canvas.on('path:created', handlePathCreated);

      // Add click handler for grid cells
      canvas.on('mouse:down', (opt) => {
        const target = opt.target;
        if (target && target.cellId && gridEnabled) {
          // Prevent drawing when clicking on grid cells
          opt.e.preventDefault();
          opt.e.stopPropagation();
          
          console.log(`🎯 Grid cell ${target.cellId} clicked - highlighting`);
          handleCellHighlight([target.cellId]);
          
          // Temporarily disable drawing mode to prevent accidental marks
          canvas.isDrawingMode = false;
          setTimeout(() => {
            canvas.isDrawingMode = true;
          }, 100);
        }
      });

      // Add hover effects for grid cells
      canvas.on('mouse:over', (opt) => {
        const target = opt.target;
        if (target && target.cellId && gridEnabled) {
          // Add hover effect - make slightly larger and more opaque
          if (target.type === 'circle') {
            target.set({ 
              strokeWidth: target.strokeWidth * 1.5,
              fill: target.fill.replace(/rgba?\(([^)]+)\)/, 'rgba($1, 0.9)')
            });
          } else if (target.type === 'text') {
            target.set({ 
              fontSize: target.fontSize * 1.1,
              fill: '#ffffff'
            });
          }
          canvas.renderAll();
        }
      });

      canvas.on('mouse:out', (opt) => {
        const target = opt.target;
        if (target && target.cellId && gridEnabled) {
          // Remove hover effect - restore original appearance
          if (target.type === 'circle') {
            target.set({ 
              strokeWidth: target.strokeWidth / 1.5,
              fill: target.fill.replace(/rgba?\(([^)]+)\)/, 'rgba($1, 1.0)')
            });
          } else if (target.type === 'text') {
            target.set({ 
              fontSize: target.fontSize / 1.1
            });
            // Restore original text color based on cell state
            const cellId = target.cellId;
            const isHighlighted = highlightedCells.includes(cellId);
            const hasMarkings = gridCellMarkings[cellId] > 0;
            let textColor = 'white';
            if (isHighlighted || hasMarkings) {
              textColor = 'white';
            } else {
              textColor = 'white';
            }
            target.set({ fill: textColor });
          }
          canvas.renderAll();
        }
      });

      // Add mouse wheel zoom support with better limits
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        
        // Better zoom limits for PDF viewing
        if (zoom > 20) zoom = 20;        // Max 2000% zoom
        if (zoom < 0.1) zoom = 0.1;      // Min 10% zoom (increased from 1% for readability)
        
        setZoomLevel(zoom);
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        
        // Redraw grid after zoom to match new viewport
        if (gridEnabled) {
          // Small delay to let zoom settle, then redraw grid in new viewport
          setTimeout(() => {
            console.log('🔄 Redrawing grid after zoom...');
            const viewportBeforeRedraw = preserveViewportState();
            drawGrid();
            // Ensure zoom operation viewport is maintained
            restoreViewportState(viewportBeforeRedraw);
          }, 50);
        }
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Add pan support with Alt key (Option key on Mac)
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
          
          // Redraw grid after pan operation to match new viewport
          if (gridEnabled) {
            setTimeout(() => {
              console.log('🔄 Redrawing grid after pan...');
              const viewportBeforePanRedraw = preserveViewportState();
              drawGrid();
              // Ensure pan operation viewport is maintained
              restoreViewportState(viewportBeforePanRedraw);
            }, 50);
          }
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

  // Ensure grid stays on top
  const ensureGridOnTop = () => {
    if (gridEnabled && gridOverlay && fabricRef.current) {
      const canvas = fabricRef.current;
      try {
        // Bring grid to front multiple times to ensure it stays on top
        canvas.bringToFront(gridOverlay);
        canvas.renderAll();
        
        // Verify grid is actually on top
        const objects = canvas.getObjects();
        const gridIndex = objects.indexOf(gridOverlay);
        console.log(`Grid overlay index: ${gridIndex} of ${objects.length} objects`);
        
        // If grid is not the last object, force it to front again
        if (gridIndex !== objects.length - 1) {
          console.log('Grid not on top, forcing to front...');
          canvas.bringToFront(gridOverlay);
          canvas.renderAll();
        }
      } catch (error) {
        console.warn('Error ensuring grid on top:', error);
      }
    }
  };

  // Update canvas viewport
  const updateCanvasViewport = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    canvas.setZoom(zoomLevel);
    canvas.viewportTransform[4] = panOffset.x;
    canvas.viewportTransform[5] = panOffset.y;
    canvas.requestRenderAll();
    
    // Redraw grid to match new viewport after programmatic changes
    if (gridEnabled) {
      setTimeout(() => {
        console.log('🔄 Redrawing grid after viewport update...');
        drawGrid();
      }, 50);
    }
  };

  // Fit image to screen with better zoom handling
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
    
    // For high-resolution PDF conversions, ensure reasonable zoom levels
    newZoom *= 0.85; // Slightly less padding for better utilization
    
    // Ensure minimum zoom for readability - especially important for PDFs
    const minZoom = 0.2; // Minimum 20% zoom
    const maxZoom = 3.0;  // Maximum 300% zoom for initial fit
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    
    setZoomLevel(newZoom);
    
    // Center the image
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
                
                // Enhance image properties for better visibility
                img.set({
                  opacity: 1.0,        // Ensure full opacity
                  brightness: 0,       // No brightness adjustment
                  contrast: 0,         // No contrast adjustment initially
                  saturation: 0,       // Keep original saturation
                  originX: 'left',
                  originY: 'top',
                  selectable: false,
                  evented: false
                });
                
                // Add image as a regular object instead of background to ensure proper layering
                img.set({
                  left: 0,
                  top: 0,
                  selectable: false,
                  evented: false,
                  name: 'backgroundImage'
                });
                
                // Clear canvas and add image
                canvas.clear();
                canvas.add(img);
                
                console.log('Background image added as object, redrawing grid...');
                canvas.renderAll();
                
                // Redraw grid on top after background image is loaded
                if (gridEnabled) {
                  // Single attempt should be sufficient now
                  setTimeout(() => {
                    console.log('Drawing grid over background image...');
                    drawGrid();
                  }, 100);
                }

                // Auto-fit to screen for better initial view
                if (fitToScreen) {
                  // Use a more appropriate initial zoom for PDFs
                  setTimeout(() => {
                    fitImageToScreen(img);
                                         // Ensure minimum readable zoom level for PDFs
                     const currentZoom = canvas.getZoom();
                     if (currentZoom < 0.25) {
                                            // For high-res PDFs, ensure at least 25% zoom
                     const betterZoom = 0.3;
                     setZoomLevel(betterZoom);
                     canvas.setZoom(betterZoom);
                     canvas.renderAll();
                     console.log(`Zoom adjusted for readability: ${(betterZoom * 100).toFixed(0)}%`);
                     
                     // Redraw grid after zoom adjustment
                     if (gridEnabled) {
                       setTimeout(() => {
                         console.log('🔄 Redrawing grid after PDF zoom adjustment...');
                         drawGrid();
                       }, 100);
                     }
                   }
                  }, 50);
                }
                
                console.log(`Background image loaded: ${img.width}x${img.height} pixels`);
              } else {
                console.warn('Image loaded but dimensions are invalid');
                canvas.renderAll();
              }
            },
            {
              crossOrigin: 'anonymous',
              // Add image loading options for better quality
              imageSourceAltText: 'PDF converted to image'
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
      
      // Redraw grid to match new zoom level
      if (gridEnabled) {
        setTimeout(() => {
          console.log('🔄 Redrawing grid after zoom in...');
          const viewportBeforeZoomInRedraw = preserveViewportState();
          drawGrid();
          // Maintain zoom-in viewport state
          restoreViewportState(viewportBeforeZoomInRedraw);
        }, 50);
      }
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.2, 0.1); // Respect minimum zoom limit
    setZoomLevel(newZoom);
    if (fabricRef.current) {
      fabricRef.current.setZoom(newZoom);
      fabricRef.current.requestRenderAll();
      
      // Redraw grid to match new zoom level
      if (gridEnabled) {
        setTimeout(() => {
          console.log('🔄 Redrawing grid after zoom out...');
          const viewportBeforeZoomOutRedraw = preserveViewportState();
          drawGrid();
          // Maintain zoom-out viewport state
          restoreViewportState(viewportBeforeZoomOutRedraw);
        }, 50);
      }
    }
  };

  const handleFitToScreen = () => {
    if (backgroundImage && fabricRef.current) {
      const canvas = fabricRef.current;
      const bgObj = canvas.getObjects().find(obj => obj.name === 'backgroundImage');
      if (bgObj) {
        fitImageToScreen(bgObj);
        
        // Redraw grid to match new viewport
        if (gridEnabled) {
          setTimeout(() => {
            console.log('🔄 Redrawing grid after fit to screen...');
            drawGrid();
          }, 100);
        }
      }
    }
  };

  const clearMarkings = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // Remove all drawn paths but keep background image and grid
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.type === 'path') {
        canvas.remove(obj);
      }
    });
    
    setMarkings([]);
    setGridCellMarkings({});
    canvas.renderAll();
  };

  const undoLastMarking = () => {
    if (markings.length === 0) return;
    
    const canvas = fabricRef.current;
    const objects = canvas.getObjects();
    
    // Find and remove the last path object (skip background image and grid)
    for (let i = objects.length - 1; i >= 0; i--) {
      if (objects[i].type === 'path') {
        canvas.remove(objects[i]);
        break;
      }
    }
    
    // Get the last marking to update grid cell count
    const lastMarking = markings[markings.length - 1];
    if (lastMarking && lastMarking.gridCell) {
      setGridCellMarkings(prev => {
        const updated = { ...prev };
        const cellId = lastMarking.gridCell.cellId;
        if (updated[cellId] > 1) {
          updated[cellId] -= 1;
        } else {
          delete updated[cellId];
        }
        return updated;
      });
    }
    
    setMarkings(prev => prev.slice(0, -1));
    canvas.renderAll();
  };

  // Generate count prompt when markings are made
  const generateCountPrompt = () => {
    if (markings.length === 0) return '';
    
    let prompt = '';
    
    if (gridEnabled) {
      // Grid-based prompt with cell references
      const cellsWithMarkings = Object.keys(gridCellMarkings).filter(cellId => gridCellMarkings[cellId] > 0);
      const cellsText = cellsWithMarkings.map(cellId => `cell ${cellId} (${gridCellMarkings[cellId]} marking${gridCellMarkings[cellId] > 1 ? 's' : ''})`).join(', ');
      
      prompt = `This image has a ${gridRows}×${gridCols} grid overlay with numbered cells (1-${gridRows * gridCols}) at the top left of each grid cell. I have made markings in the following grid cells: ${cellsText}. 

Please count all occurrences (not exact wordings, but similar icons) of the items I've marked in each grid cell and provide a structured response in this format:

**Grid Cell Analysis:**
- Cell X: [count] items found - [description]
- Cell Y: [count] items found - [description]

**Total Count:** [total across all cells]
**Summary:** [brief description of what was counted]

Focus on the specific cells where I made markings: ${cellsWithMarkings.join(', ')}.`;
    } else {
      // Standard prompt without grid
      prompt = `Count how many occurrences of the items I have marked/circled in ${brushColor === '#22c55e' ? 'green' : 'colored'} markings are visible in this ${captureMode === 'visible' ? 'visible area of the' : 'entire'} drawing. I have made ${markings.length} marking(s) to help identify what to count. Please provide a detailed count and explain what you're counting.`;
    }
    
    // Dispatch action to set this prompt in chat input
    window.dispatchEvent(new CustomEvent('setCountPrompt', { 
      detail: { 
        prompt, 
        hasMarkings: markings.length > 0,
        gridEnabled,
        gridCellMarkings: gridEnabled ? gridCellMarkings : null
      } 
    }));
    
    return prompt;
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
            <p className="text-sm mt-1">Switch to visible canvas mode to use the count tool.</p>
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
              {!toolPanelExpanded && (
                <p className="mt-1 text-xs opacity-75">Click panel in top-left to expand</p>
              )}
            </div>
          )}
        </div>

        {/* Floating Count Tool Panel */}
        <div className={`absolute top-4 left-4 z-20 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl transition-all duration-300 ${
          toolPanelExpanded ? 'w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto' : 'w-auto'
        }`}>
          {/* Panel Header - Always Visible */}
          <div className="p-3 border-b border-gray-600/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <h3 className="text-sm font-medium text-white">Count Tool</h3>
                {markings.length > 0 && (
                  <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded-full">
                    {markings.length}
                  </span>
                )}
                {gridEnabled && (
                  <span className="px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full">
                    📊 {gridRows}×{gridCols}
                  </span>
                )}
                {currentFileIsPdf && (
                  <span className="px-2 py-1 bg-emerald-600 text-emerald-100 text-xs rounded-full" title="Enhanced PDF rendering active">
                    ✨ PDF
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                {!toolPanelExpanded && (
                  <button
                    onClick={() => {
                      setGridEnabled(!gridEnabled);
                      // Auto-expand panel when enabling grid for first time
                      if (!gridEnabled) {
                        setToolPanelExpanded(true);
                      }
                    }}
                    className={`p-1 text-xs rounded transition-colors ${
                      gridEnabled 
                        ? 'bg-blue-500 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                    title={gridEnabled ? 'Disable grid' : 'Enable grid'}
                  >
                    📊
                  </button>
                )}
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
                        Count tool works with image/PDF files.
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {/* Grid Overlay Controls */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Grid Overlay</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="gridEnabled"
                      checked={gridEnabled}
                      onChange={(e) => setGridEnabled(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                    />
                    <label htmlFor="gridEnabled" className="text-xs text-gray-200">
                      Enable grid overlay
                    </label>
                  </div>
                  
                  {gridEnabled && (
                    <div className="space-y-2 pl-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-300 w-10">Rows:</label>
                        <input
                          type="number"
                          min="2"
                          max="8"
                          value={gridRows}
                          onChange={(e) => setGridRows(parseInt(e.target.value))}
                          className="w-14 px-1 py-1 text-xs bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-300 w-10">Cols:</label>
                        <input
                          type="number"
                          min="2"
                          max="8"
                          value={gridCols}
                          onChange={(e) => setGridCols(parseInt(e.target.value))}
                          className="w-14 px-1 py-1 text-xs bg-gray-800 border border-gray-600 text-white rounded focus:border-blue-500"
                        />
                      </div>
                      <div className="text-xs text-gray-400">
                        {gridRows}×{gridCols} = {gridRows * gridCols} cells
                        {gridOverlay && (
                          <div className="text-green-400 text-xs mt-1">
                            ✓ Grid active
                          </div>
                        )}
                      </div>
                      
                      {/* Test buttons for grid highlighting */}
                      {gridEnabled && (
                        <div className="space-y-1 mt-2 hidden">
                          <button
                            onClick={() => {
                              console.log('🧪 Testing grid highlight with cells 1, 2, 3');
                              handleCellHighlight([1, 2, 3]);
                            }}
                            className="w-full px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-500 transition-colors"
                          >
                            🧪 Test Highlight (cells 1-3)
                          </button>
                          
                          <button
                            onClick={() => {
                              console.log('🎯 Testing single cell highlight - center cell');
                              const centerCell = Math.ceil((gridRows * gridCols) / 2);
                              handleCellHighlight([centerCell]);
                            }}
                            className="w-full px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                          >
                            🎯 Test Center Cell
                          </button>
                          
                          <button
                            onClick={() => {
                              console.log('🔄 Clearing all highlights with viewport preservation');
                              const viewportBeforeClear = preserveViewportState();
                              setHighlightedCells([]);
                              drawGrid();
                              restoreViewportState(viewportBeforeClear);
                            }}
                            className="w-full px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                          >
                            ❌ Clear Highlights
                          </button>
                          
                          <button
                            onClick={() => {
                              console.log('🧪 Testing viewport preservation during highlight cycle');
                              const testCells = [5, 6, 9, 10]; // Center cells
                              handleCellHighlight(testCells);
                              
                              // Auto-clear after 3 seconds to test preservation
                              setTimeout(() => {
                                console.log('🧪 Test auto-clear with viewport preservation');
                                const testViewport = preserveViewportState();
                                setHighlightedCells([]);
                                setTimeout(() => {
                                  drawGrid();
                                  restoreViewportState(testViewport);
                                }, 100);
                              }, 3000);
                            }}
                            className="w-full px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors"
                          >
                            🧪 Test Viewport Preservation
                          </button>
                          
                          <button
                            onClick={() => {
                              console.log('🔗 Testing chat cell click simulation');
                              // First, log current state for debugging
                              console.log('DEBUG STATE CHECK:');
                              console.log('   - gridEnabled:', gridEnabled);
                              console.log('   - gridOverlay exists:', !!gridOverlay);
                              console.log('   - fabricRef.current exists:', !!fabricRef.current);
                              console.log('   - canvasInitialized:', canvasInitialized);
                              
                              // Simulate clicking on cell references in chat
                              const testCellsText = "1,3,5";
                              console.log('   Simulating grid annotation service cell click with data:', testCellsText);
                              gridAnnotationService.handleCellClick(testCellsText);
                            }}
                            className="w-full px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500 transition-colors"
                          >
                            🔗 Test Chat Click (cells 1,3,5)
                          </button>
                          
                          <button
                            onClick={() => {
                              console.log('🩺 DIAGNOSTIC: Checking grid state...');
                              console.log('   - gridEnabled state:', gridEnabled);
                              console.log('   - gridOverlay exists:', !!gridOverlay);
                              console.log('   - Canvas ready:', !!fabricRef.current);
                              console.log('   - Canvas initialized:', canvasInitialized);
                              
                              if (fabricRef.current) {
                                const objects = fabricRef.current.getObjects();
                                const gridObjects = objects.filter(obj => obj.name === 'gridOverlay');
                                console.log(`   - Grid objects on canvas: ${gridObjects.length}`);
                                console.log(`   - Total canvas objects: ${objects.length}`);
                              }
                              
                              // Force enable grid if it should be enabled
                              if (!gridEnabled) {
                                console.log('🔧 FORCE ENABLING GRID...');
                                setGridEnabled(true);
                              }
                            }}
                            className="w-full px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors"
                          >
                            🩺 Diagnose & Fix Grid
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Markings Status */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Markings</h4>
                <div className="space-y-2">
                  {markings.length === 0 ? (
                    <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                      No markings yet. Draw to mark items.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs bg-green-900/40 border border-green-600/50 rounded p-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brushColor }}></div>
                          <span className="text-green-200">{markings.length} marking(s) made</span>
                        </div>
                      </div>
                      
                      {gridEnabled && Object.keys(gridCellMarkings).length > 0 && (
                        <div className="text-xs bg-blue-900/40 border border-blue-600/50 rounded p-2">
                          <div className="font-medium mb-1 text-blue-200">Grid cells:</div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(gridCellMarkings).map(([cellId, count]) => (
                              <span key={cellId} className="px-1 py-0.5 bg-blue-700 text-blue-100 rounded text-xs">
                                {cellId}:{count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {gridEnabled && highlightedCells.length > 0 && (
                        <div className="text-xs bg-purple-900/60 border border-purple-500/70 rounded p-2">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                            <span className="font-medium text-purple-200">Highlighted Cells:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {highlightedCells.map(cellId => (
                              <span key={cellId} className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-bold border border-purple-400">
                                #{cellId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => generateCountPrompt()}
                    disabled={markings.length === 0 || isWholeFileMode}
                    className={`w-full px-3 py-2 text-xs rounded transition-colors font-medium ${
                      markings.length > 0 && !isWholeFileMode
                        ? 'bg-green-600 text-white hover:bg-green-500'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Generate Count Prompt
                  </button>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => undoLastMarking()}
                      disabled={markings.length === 0}
                      className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                        markings.length > 0
                          ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Undo
                    </button>
                    
                    <button
                      onClick={() => clearMarkings()}
                      disabled={markings.length === 0}
                      className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                        markings.length > 0
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountTool; 