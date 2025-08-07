import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fabric } from 'fabric';
import { FaSearchPlus, FaSearchMinus, FaExpandArrowsAlt, FaRuler, FaCog } from 'react-icons/fa';
import { updateToolSettings } from '../../store/slices/toolsSlice';
import canvasService from '../../services/canvasService';

const MeasurementTool = ({ file, scale = 1 }) => {
  const dispatch = useDispatch();
  const { toolSettings } = useSelector(state => state.tools);
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const [measurements, setMeasurements] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentLine, setCurrentLine] = useState(null);
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
  
  // Use REF for calibration data - always current in event handlers
  const calibrationRef = useRef({
    isCalibrated: false,
    pixelsPerUnit: null,
    unit: 'mm',
    referenceLine: null
  });
  
  // UI state for modal
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [pendingCalibration, setPendingCalibration] = useState(null);
  
  // UI state
  const [toolPanelExpanded, setToolPanelExpanded] = useState(false);
  
  // Vector snapping state
  const [vectorPaths, setVectorPaths] = useState([]);
  const [hasVectorData, setHasVectorData] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapDistance, setSnapDistance] = useState(10); // pixels
  const [snapPreview, setSnapPreview] = useState(null);
  const [showVectorOverlay, setShowVectorOverlay] = useState(false); // Debug overlay toggle

  // Get settings from Redux with fallbacks
  const measureSettings = toolSettings?.measure || {
    scale: 1,
    unit: 'mm',
    lineColor: '#0066CC',
    lineWidth: 2,
    captureMode: 'visible'
  };
  const { captureMode } = measureSettings;
  const lineColor = '#FF0066';
  const lineWidth = 3;

  // Update settings helper
  const updateSettings = (newSettings) => {
    dispatch(updateToolSettings({
      tool: 'measure',
      settings: newSettings
    }));
  };

  // Render PDF directly to fabric canvas preserving vector data
  const renderPdfToCanvas = async (fileUrl, fabricCanvas) => {
    try {
      setIsPdfLoading(true);
      console.log('🎨 Rendering PDF directly to fabric canvas...');
      
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
      
      const baseScale = 2.0; // Reduced from 4.0 for better performance
      const viewport = page.getViewport({ scale: baseScale });
      
      // Create temporary canvas for PDF rendering
      const tempCanvas = document.createElement('canvas');
      const tempContext = tempCanvas.getContext('2d');
      
      tempCanvas.height = viewport.height;
      tempCanvas.width = viewport.width;
      
      tempContext.imageSmoothingEnabled = false;
      tempContext.textRenderingOptimization = 'optimizeSpeed';
      
      // Render PDF to temporary canvas
      await page.render({ 
        canvasContext: tempContext, 
        viewport: viewport,
        renderInteractiveForms: false,
        intent: 'print'
      }).promise;
      
      console.log(`🎨 PDF rendered to canvas: ${viewport.width}x${viewport.height} at ${baseScale}x scale`);
      
      // Create fabric image from the canvas (not data URL)
      const fabricImage = new fabric.Image(tempCanvas, {
        opacity: 1.0,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        left: 0,
        top: 0,
        name: 'backgroundImage'
      });
      
      // Store PDF metadata for coordinate alignment
      fabricImage.pdfMetadata = {
        viewport,
        scale: baseScale,
        width: viewport.width,
        height: viewport.height
      };
      
      return fabricImage;
      
    } catch (error) {
      console.error('Failed to render PDF to canvas:', error);
      throw error;
    } finally {
      setIsPdfLoading(false);
    }
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

  // Calculate distance between two points
  const calculateDistance = (point1, point2) => {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  };

  // Convert pixels to real-world units using calibration
  const pixelsToUnits = (pixels) => {
    if (!calibrationRef.current.pixelsPerUnit) return pixels;
    return pixels / calibrationRef.current.pixelsPerUnit;
  };

  // Handle calibration completion
  const completeCalibration = (realMeasurement, unit) => {
    if (!pendingCalibration) return;
    
    console.log('🎯 SETTING CALIBRATION');
    
    const { line, pixelDistance } = pendingCalibration;
    const newPixelsPerUnit = pixelDistance / realMeasurement;
    
    // Update calibration ref - this is immediately available to event handlers
    calibrationRef.current = {
      isCalibrated: true,
      pixelsPerUnit: newPixelsPerUnit,
      unit: unit,
      referenceLine: line
    };
    
    console.log('✅ CALIBRATION COMPLETE:', {
      isCalibrated: calibrationRef.current.isCalibrated,
      pixelsPerUnit: calibrationRef.current.pixelsPerUnit,
      unit: calibrationRef.current.unit
    });
    
    // Update line appearance
    line.set({
      stroke: '#FF6B35',
      strokeDashArray: [10, 5]
    });
    
    // Update text
    const canvas = fabricRef.current;
    if (canvas && pendingCalibration.text) {
      pendingCalibration.text.set({
        text: `📏 ${realMeasurement} ${unit} (Reference)`,
        backgroundColor: '#FF6B35'
      });
    }
    
    canvas.renderAll();
    
    setShowCalibrationModal(false);
    setPendingCalibration(null);
    
    console.log('🎉 Ready to measure! Next lines will show real measurements.');
  };

  // Reset calibration
  const resetCalibration = () => {
    calibrationRef.current = {
      isCalibrated: false,
      pixelsPerUnit: null,
      unit: 'mm',
      referenceLine: null
    };
    
    clearMeasurements();
    console.log('🔄 Calibration reset');
  };

  // Extract vector paths from PDF with same coordinate system as rendering
  const extractVectorPaths = async (fileUrl, pdfMetadata = null) => {
    try {
      console.log('🔍 Extracting vector paths from PDF...');
      
      if (!window.pdfjsLib) {
        throw new Error('PDF.js not loaded');
      }

      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0 
      }).promise;
      
      const page = await pdf.getPage(1);
      // Use same scale as rendering to ensure coordinate alignment
      const renderScale = pdfMetadata?.scale || 2.0;
      const viewport = page.getViewport({ scale: renderScale });
      
      // Get the page content stream
      const opList = await page.getOperatorList();
      const paths = [];
      let currentPath = [];
      let currentPoint = null;
      
      console.log('📄 Processing', opList.fnArray.length, 'PDF operations');
      console.log('🔍 Available PDF operations:', Object.keys(window.pdfjsLib.OPS).slice(0, 20), '... (showing first 20)');
      
      // Count operation types for debugging
      const opCounts = {};
      
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];
        
        // Count operations
        const opName = Object.keys(window.pdfjsLib.OPS).find(key => window.pdfjsLib.OPS[key] === fn) || `Unknown_${fn}`;
        opCounts[opName] = (opCounts[opName] || 0) + 1;
        
        switch (fn) {
          case window.pdfjsLib.OPS.moveTo:
            currentPoint = { x: args[0], y: viewport.height - args[1] }; // Flip Y coordinate
            currentPath = [currentPoint];
            console.log('📍 moveTo:', currentPoint);
            break;
            
          case window.pdfjsLib.OPS.lineTo:
            if (currentPoint) {
              const endPoint = { x: args[0], y: viewport.height - args[1] };
              currentPath.push(endPoint);
              paths.push({
                type: 'line',
                start: currentPoint,
                end: endPoint,
                points: [currentPoint, endPoint]
              });
              currentPoint = endPoint;
              console.log('📏 lineTo:', endPoint);
            }
            break;
            
          case window.pdfjsLib.OPS.curveTo:
            if (currentPoint) {
              const endPoint = { x: args[4], y: viewport.height - args[5] };
              paths.push({
                type: 'curve',
                start: currentPoint,
                end: endPoint,
                cp1: { x: args[0], y: viewport.height - args[1] },
                cp2: { x: args[2], y: viewport.height - args[3] },
                points: [currentPoint, endPoint]
              });
              currentPoint = endPoint;
              console.log('🌊 curveTo:', endPoint);
            }
            break;
            
          case window.pdfjsLib.OPS.bezierCurveTo:
            if (currentPoint) {
              const endPoint = { x: args[4], y: viewport.height - args[5] };
              paths.push({
                type: 'curve',
                start: currentPoint,
                end: endPoint,
                cp1: { x: args[0], y: viewport.height - args[1] },
                cp2: { x: args[2], y: viewport.height - args[3] },
                points: [currentPoint, endPoint]
              });
              currentPoint = endPoint;
              console.log('🌊 bezierCurveTo:', endPoint);
            }
            break;
            
          case window.pdfjsLib.OPS.closePath:
            if (currentPath.length > 1) {
              const firstPoint = currentPath[0];
              const lastPoint = currentPath[currentPath.length - 1];
              if (firstPoint && lastPoint && firstPoint !== lastPoint) {
                paths.push({
                  type: 'line',
                  start: lastPoint,
                  end: firstPoint,
                  points: [lastPoint, firstPoint]
                });
                console.log('🔄 closePath:', lastPoint, 'to', firstPoint);
              }
            }
            break;
            
          case window.pdfjsLib.OPS.rectangle:
            // Rectangle: x, y, width, height
            const x = args[0];
            const y = viewport.height - args[1] - args[3]; // Flip and adjust for height
            const width = args[2];
            const height = args[3];
            
            console.log('📦 rectangle:', {x, y, width, height});
            
            const rectPaths = [
              { type: 'line', start: {x, y}, end: {x: x + width, y}, points: [{x, y}, {x: x + width, y}] },
              { type: 'line', start: {x: x + width, y}, end: {x: x + width, y: y + height}, points: [{x: x + width, y}, {x: x + width, y: y + height}] },
              { type: 'line', start: {x: x + width, y: y + height}, end: {x, y: y + height}, points: [{x: x + width, y: y + height}, {x, y: y + height}] },
              { type: 'line', start: {x, y: y + height}, end: {x, y}, points: [{x, y: y + height}, {x, y}] }
            ];
            paths.push(...rectPaths);
            break;
            
          // Handle stroke operations that might indicate paths
          case window.pdfjsLib.OPS.stroke:
            console.log('🖋️ stroke operation detected');
            break;
            
          case window.pdfjsLib.OPS.fill:
            console.log('🎨 fill operation detected');
            break;
            
          case window.pdfjsLib.OPS.fillStroke:
            console.log('🖋️🎨 fillStroke operation detected');
            break;
            
          // Handle transformation matrices that might affect coordinates
          case window.pdfjsLib.OPS.transform:
            console.log('🔄 transform operation:', args);
            break;
            
          // Handle other potential path operations
          case window.pdfjsLib.OPS.quadraticCurveTo:
            if (currentPoint) {
              const endPoint = { x: args[2], y: viewport.height - args[3] };
              paths.push({
                type: 'curve',
                start: currentPoint,
                end: endPoint,
                cp1: { x: args[0], y: viewport.height - args[1] },
                cp2: null,
                points: [currentPoint, endPoint]
              });
              currentPoint = endPoint;
              console.log('🌊 quadraticCurveTo:', endPoint);
            }
            break;
        }
      }
      
      // Log operation summary
      console.log('📊 Operation Summary:', opCounts);
      console.log('📊 Total drawing operations found:', 
        (opCounts.moveTo || 0) + (opCounts.lineTo || 0) + (opCounts.curveTo || 0) + 
        (opCounts.bezierCurveTo || 0) + (opCounts.quadraticCurveTo || 0) + (opCounts.rectangle || 0)
      );
      
      console.log(`✅ Extracted ${paths.length} vector paths from PDF`);
      console.log('📏 Coordinate system:', { 
        viewportWidth: viewport.width, 
        viewportHeight: viewport.height, 
        scale: renderScale 
      });
      
      if (paths.length > 0) {
        setVectorPaths(paths);
        setHasVectorData(true);
        console.log('🎯 Vector snapping enabled - found drawable paths');
        console.log('📊 Path types:', paths.reduce((acc, path) => {
          acc[path.type] = (acc[path.type] || 0) + 1;
          return acc;
        }, {}));
        
        // Log sample of paths for debugging
        if (paths.length > 0) {
          console.log('📍 Sample path coordinates:', paths.slice(0, 3).map(p => ({
            type: p.type,
            start: p.start,
            end: p.end
          })));
        }
      } else {
        setVectorPaths([]);
        setHasVectorData(false);
        console.log('📝 No vector paths found - PDF may be image-based or using unsupported operations');
        console.log('💡 Consider checking if PDF operations include:', Object.keys(opCounts).filter(op => opCounts[op] > 0));
      }
      
      return { paths, viewport };
      
    } catch (error) {
      console.error('❌ Failed to extract vector paths:', error);
      setVectorPaths([]);
      setHasVectorData(false);
      return [];
    }
  };

  // Find closest point on a line segment
  const closestPointOnLine = (point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return lineStart; // Line is a point
    
    let param = dot / lenSq;
    
    // Clamp to line segment
    if (param < 0) param = 0;
    if (param > 1) param = 1;
    
    return {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D
    };
  };

  // Find nearest snap point
  const findSnapPoint = (mousePoint) => {
    if (!snapEnabled || !hasVectorData || vectorPaths.length === 0) {
      return null;
    }
    
    let closestSnap = null;
    let minDistance = snapDistance;
    
    vectorPaths.forEach(path => {
      if (path.type === 'line') {
        const snapPoint = closestPointOnLine(mousePoint, path.start, path.end);
        const distance = calculateDistance(mousePoint, snapPoint);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestSnap = {
            point: snapPoint,
            distance,
            path,
            type: 'line'
          };
        }
        
        // Also check line endpoints
        const startDistance = calculateDistance(mousePoint, path.start);
        const endDistance = calculateDistance(mousePoint, path.end);
        
        if (startDistance < minDistance) {
          minDistance = startDistance;
          closestSnap = {
            point: path.start,
            distance: startDistance,
            path,
            type: 'endpoint'
          };
        }
        
        if (endDistance < minDistance) {
          minDistance = endDistance;
          closestSnap = {
            point: path.end,
            distance: endDistance,
            path,
            type: 'endpoint'
          };
        }
      }
    });
    
    return closestSnap;
  };

  // Apply snap to point
  const applySnap = (point) => {
    const snap = findSnapPoint(point);
    return snap ? snap.point : point;
  };

  // Render vector paths as visual overlays for debugging alignment
  const renderVectorPathOverlay = (canvas, paths, show = false) => {
    if (!show || !paths || paths.length === 0) return;
    
    console.log('🔍 Rendering vector path overlay for debugging...');
    
    paths.forEach((path, index) => {
      if (path.type === 'line') {
        const overlayLine = new fabric.Line([
          path.start.x,
          path.start.y,
          path.end.x,
          path.end.y
        ], {
          stroke: '#00FF00',
          strokeWidth: 1,
          selectable: false,
          evented: false,
          opacity: 0.5,
          strokeDashArray: [2, 2],
          name: 'vectorPathOverlay',
          excludeFromExport: true
        });
        
        canvas.add(overlayLine);
        
        // Add small circles at endpoints
        [path.start, path.end].forEach(point => {
          const circle = new fabric.Circle({
            left: point.x - 2,
            top: point.y - 2,
            radius: 2,
            fill: '#00FF00',
            stroke: '#FFFFFF',
            strokeWidth: 0.5,
            selectable: false,
            evented: false,
            opacity: 0.7,
            name: 'vectorPathOverlay',
            excludeFromExport: true
          });
          canvas.add(circle);
        });
      }
    });
    
    canvas.renderAll();
    console.log(`✅ Rendered ${paths.length} vector path overlays`);
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
        isDrawingMode: false,
        width: containerWidth,
        height: containerHeight,
        renderOnAddRemove: true,
        skipTargetFind: false,
        imageSmoothingEnabled: false,
        preserveObjectStacking: true,
        backgroundColor: 'transparent'
      });

    const canvas = fabricRef.current;
      
      // Local variables to track drawing state (not React state)
      let isCurrentlyDrawing = false;
      let drawingStartPoint = null;
      let previewLine = null;
      let isPanning = false;
      let panStart = { x: 0, y: 0 };
      
      // Optimize canvas for high-quality rendering
      const ctx = canvas.getContext();
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        ctx.oImageSmoothingEnabled = false;
      }

      console.log('🎨 Canvas initialized with direct drawing mechanism');

      // Mouse down handler
      canvas.on('mouse:down', (opt) => {
        const evt = opt.e;
        
        console.log('🖱️ MOUSE DOWN');
        
        // Handle panning with Alt key
        if (evt.altKey === true) {
          isPanning = true;
          canvas.selection = false;
          panStart = { x: evt.clientX, y: evt.clientY };
          console.log('🤏 Started panning');
          return;
        }

        // Ignore if clicking on existing objects (except background)
        if (opt.target && opt.target.name !== 'backgroundImage') {
          console.log('👆 Clicked on object, ignoring:', opt.target.name);
          return;
        }

        // Start drawing line
        isCurrentlyDrawing = true;
        const pointer = canvas.getPointer(evt);
        drawingStartPoint = { x: pointer.x, y: pointer.y };
        
        // Apply snapping to start point
        const snappedStart = applySnap(drawingStartPoint);
        if (snappedStart !== drawingStartPoint) {
          drawingStartPoint = snappedStart;
          console.log('🎯 Snapped to start point:', drawingStartPoint);
        }
        
        setIsDrawing(true); // Update React state for UI indicators
        
        console.log('✏️ STARTED DRAWING at:', drawingStartPoint);
      });

      // Mouse move handler
      canvas.on('mouse:move', (opt) => {
        const evt = opt.e;
        
        // Handle panning
        if (isPanning) {
          const vpt = canvas.viewportTransform;
          vpt[4] += evt.clientX - panStart.x;
          vpt[5] += evt.clientY - panStart.y;
          canvas.requestRenderAll();
          panStart = { x: evt.clientX, y: evt.clientY };
          return;
        }

        // Update line preview while drawing
        if (isCurrentlyDrawing && drawingStartPoint) {
          const pointer = canvas.getPointer(evt);
          let endPoint = { x: pointer.x, y: pointer.y };
          
          // Apply snapping to end point
          const snappedEnd = applySnap(endPoint);
          const snap = findSnapPoint(endPoint);
          
          if (snap) {
            endPoint = snap.point;
            
            // Show snap preview indicator
            if (snapPreview) {
              canvas.remove(snapPreview);
            }
            
            snapPreview = new fabric.Circle({
              left: endPoint.x - 4,
              top: endPoint.y - 4,
              radius: 4,
              fill: 'transparent',
              stroke: '#00FF00',
      strokeWidth: 2,
              selectable: false,
              evented: false,
              excludeFromExport: true
            });
            
            canvas.add(snapPreview);
            canvas.bringToFront(snapPreview);
          } else {
            // Remove snap preview if no snap
            if (snapPreview) {
              canvas.remove(snapPreview);
              snapPreview = null;
            }
          }
          
          // Remove previous preview line
          if (previewLine) {
            canvas.remove(previewLine);
            previewLine = null;
          }

          // Create new preview line
          previewLine = new fabric.Line([
            drawingStartPoint.x,
            drawingStartPoint.y,
            endPoint.x,
            endPoint.y
          ], {
            stroke: snap ? '#00FF00' : lineColor, // Green if snapped
            strokeWidth: lineWidth,
            selectable: false,
            evented: false,
            excludeFromExport: false,
            opacity: 0.7,
            strokeDashArray: [8, 4],
            shadow: new fabric.Shadow({
              color: 'rgba(0, 0, 0, 0.3)',
              blur: 2,
              offsetX: 1,
              offsetY: 1
            })
          });

          canvas.add(previewLine);
          canvas.bringToFront(previewLine);
          canvas.renderAll();
        }
      });

      // Mouse up handler
      canvas.on('mouse:up', () => {
        console.log('🏁 MOUSE UP - isPanning:', isPanning, 'isCurrentlyDrawing:', isCurrentlyDrawing);
        
        if (isPanning) {
          isPanning = false;
          console.log('🤏 Finished panning');
          return;
        }

        if (isCurrentlyDrawing && drawingStartPoint && previewLine) {
          console.log('🎯 COMPLETING LINE DRAWING');
          console.log('🔍 CALIBRATION STATE CHECK:');
          console.log('   - isCalibrated:', calibrationRef.current.isCalibrated);
          console.log('   - pixelsPerUnit:', calibrationRef.current.pixelsPerUnit);
          console.log('   - calibrationUnit:', calibrationRef.current.unit);
          console.log('   - calibrationLine exists:', !!calibrationRef.current.referenceLine);
          
          // Calculate end point and distance with final snapping
          let endPoint = {
            x: previewLine.x2,
            y: previewLine.y2
          };
          
          // Apply final snapping
          const snappedEnd = applySnap(endPoint);
          if (snappedEnd !== endPoint) {
            endPoint = snappedEnd;
            console.log('🎯 Final snap applied to end point:', endPoint);
          }
          
          // Clean up snap preview
          if (snapPreview) {
            canvas.remove(snapPreview);
            snapPreview = null;
          }
          
          const pixelDistance = calculateDistance(drawingStartPoint, endPoint);
          console.log('📏 Line distance:', pixelDistance, 'pixels');
          
          // Check minimum distance
          if (pixelDistance < 10) {
            console.log('❌ Line too short, canceling');
            canvas.remove(previewLine);
            if (snapPreview) {
              canvas.remove(snapPreview);
              snapPreview = null;
            }
            previewLine = null;
            isCurrentlyDrawing = false;
            drawingStartPoint = null;
            setIsDrawing(false);
            return;
          }

          // Convert preview line to permanent line
          const finalLine = new fabric.Line([
            drawingStartPoint.x,
            drawingStartPoint.y,
            endPoint.x,
            endPoint.y
          ], {
            stroke: lineColor,
            strokeWidth: lineWidth,
            selectable: true,
            evented: true,
            excludeFromExport: false,
            opacity: 1.0,
            strokeDashArray: null,
            shadow: new fabric.Shadow({
              color: 'rgba(0, 0, 0, 0.3)',
              blur: 3,
              offsetX: 1,
              offsetY: 1
            })
          });

          // Remove preview and add final line
          canvas.remove(previewLine);
          canvas.add(finalLine);

          if (!calibrationRef.current.isCalibrated || !calibrationRef.current.pixelsPerUnit) {
            // This is the calibration line
            console.log('🎯 Setting up calibration line (isCalibrated=false OR pixelsPerUnit=null)');
            
            // Add temporary text showing pixel distance
            const midPoint = {
              x: (drawingStartPoint.x + endPoint.x) / 2,
              y: (drawingStartPoint.y + endPoint.y) / 2
            };

            const tempText = new fabric.Text(
              `${pixelDistance.toFixed(0)} pixels`,
              {
                left: midPoint.x,
                top: midPoint.y - 20,
                fontSize: Math.max(12 / canvas.getZoom(), 8),
        fill: '#FFFFFF',
                backgroundColor: '#FF6B35',
                padding: 4,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                excludeFromExport: false
              }
            );

            canvas.add(tempText);
    canvas.renderAll();
            
            // Set up pending calibration
            setPendingCalibration({
              line: finalLine,
              text: tempText,
              pixelDistance,
              startPoint: drawingStartPoint,
              endPoint
            });
            
            setShowCalibrationModal(true);
            
          } else {
            // This is a measurement line - calculate using calibration
            console.log('📏 CALCULATING MEASUREMENT - Tool is calibrated!');
            console.log('📏 Using calibration - isCalibrated:', calibrationRef.current.isCalibrated);
            console.log('📏 pixelsPerUnit:', calibrationRef.current.pixelsPerUnit);
            console.log('📏 pixelDistance:', pixelDistance);
            
            const realMeasurement = pixelsToUnits(pixelDistance);
            
            console.log('📐 Measurement calculated:', realMeasurement.toFixed(3), calibrationRef.current.unit);
            
            // Add measurement text with enhanced visibility
            const midPoint = {
              x: (drawingStartPoint.x + endPoint.x) / 2,
              y: (drawingStartPoint.y + endPoint.y) / 2
            };

            // Create measurement text with better styling
            const measurementText = new fabric.Text(
              `${realMeasurement.toFixed(2)} ${calibrationRef.current.unit}`,
              {
                left: midPoint.x,
                top: midPoint.y - 25, // Moved higher to avoid overlap
                fontSize: Math.max(14 / canvas.getZoom(), 10), // Larger font
        fill: '#FFFFFF',
                backgroundColor: '#FF0066', // Same color as line for consistency
                padding: 6, // More padding
                borderRadius: 4,
                originX: 'center',
                originY: 'center',
                selectable: true,
                evented: true,
                excludeFromExport: false,
                fontWeight: 'bold', // Bold text for better readability
                fontFamily: 'Arial, sans-serif',
                shadow: new fabric.Shadow({
                  color: 'rgba(0, 0, 0, 0.7)',
                  blur: 4,
                  offsetX: 2,
                  offsetY: 2
                })
              }
            );

            console.log('📝 Adding measurement text at:', midPoint.x, midPoint.y);
            canvas.add(measurementText);
            canvas.bringToFront(measurementText);

            // Store measurement in React state
            const measurement = {
              id: Date.now(),
              line: finalLine,
              text: measurementText,
              startPoint: drawingStartPoint,
              endPoint,
              pixelDistance,
              realMeasurement,
              unit: calibrationRef.current.unit,
              timestamp: new Date().toISOString()
            };

            setMeasurements(prev => {
              const newMeasurements = [...prev, measurement];
              console.log('📊 Total measurements now:', newMeasurements.length);
              return newMeasurements;
            });
            
            console.log('✅ MEASUREMENT COMPLETED:', realMeasurement.toFixed(3), calibrationRef.current.unit);
            console.log('🎯 Line and text added to canvas');
          }
          
          // Clean up drawing state
          previewLine = null;
          isCurrentlyDrawing = false;
          drawingStartPoint = null;
          setIsDrawing(false);
          
          // Clean up snap preview
          if (snapPreview) {
            canvas.remove(snapPreview);
            snapPreview = null;
          }
          
          canvas.renderAll();
          
        } else {
          console.log('⚠️ Mouse up without valid drawing state');
          // Clean up any partial state
          if (previewLine) {
            canvas.remove(previewLine);
            previewLine = null;
          }
          isCurrentlyDrawing = false;
          drawingStartPoint = null;
          setIsDrawing(false);
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

      setCanvasInitialized(true);
      console.log('🚀 Canvas with direct drawing initialized successfully');

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
  }, [containerReady]); // Only depend on containerReady, not calibration state

  // Update canvas viewport
  const updateCanvasViewport = () => {
    if (!fabricRef.current) return;
    
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
    
    newZoom *= 0.85;
    
    const minZoom = 0.2;
    const maxZoom = 3.0;
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
    console.log('🖼️ BACKGROUND IMAGE EFFECT TRIGGERED', {
      canvasInitialized,
      hasCanvas: !!fabricRef.current,
      hasFile: !!file?.url,
      fitToScreen
    });
    
    if (!canvasInitialized || !fabricRef.current) {
      console.log('🚫 Skipping background load - canvas not ready');
      return;
    }

    const canvas = fabricRef.current;
    
    console.log('🔄 Setting backgroundImage to null - about to reload');
    setBackgroundImage(null);

    const loadBackgroundImage = async () => {
      try {
    if (file?.url) {
          if (isPdfFile(file)) {
            console.log('📄 Loading PDF with direct vector rendering');
            
            // Render PDF directly to fabric canvas
            const pdfImage = await renderPdfToCanvas(file.url, canvas);
            setBackgroundImage(pdfImage);
            
            console.log('🧹 Clearing canvas and adding PDF');
            canvas.clear();
            canvas.add(pdfImage);
            
            // Extract vector paths with same coordinate system
            console.log('🔍 Extracting vector paths with matching coordinates...');
            const vectorResult = await extractVectorPaths(file.url, pdfImage.pdfMetadata);
            
            // Optional: Show vector path overlay for debugging
            if (showVectorOverlay && vectorResult.paths) {
              renderVectorPathOverlay(canvas, vectorResult.paths, true);
            }
            
            canvas.renderAll();

            if (fitToScreen) {
              setTimeout(() => {
                fitImageToScreen(pdfImage);
              }, 50);
            }
            
            console.log(`🎉 PDF rendering complete: ${pdfImage.width}x${pdfImage.height} pixels`);
            
          } else if (isImageFile(file)) {
            console.log('🖼️ Loading image background');
            
            // Clear vector data for image files
            setVectorPaths([]);
            setHasVectorData(false);
            
            fabric.Image.fromURL(
              file.url,
              (img) => {
                if (img && img.width && img.height && canvas) {
                  console.log('✅ Background image loaded successfully', img.width, 'x', img.height);
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
                    left: 0,
                    top: 0,
                    name: 'backgroundImage'
                  });
                  
                  console.log('🧹 Clearing canvas and adding background image');
                  canvas.clear();
                  canvas.add(img);
                  canvas.renderAll();

                  if (fitToScreen) {
                    setTimeout(() => {
                      fitImageToScreen(img);
                    }, 50);
                  }
                  
                  console.log(`🎉 Background image setup complete: ${img.width}x${img.height} pixels`);
                } else {
                  console.warn('❌ Failed to load background image - invalid dimensions or canvas');
                }
              },
              {
                crossOrigin: 'anonymous'
              }
            );
          }
        } else {
          console.log('📭 No file URL - rendering empty canvas');
          canvas.renderAll();
        }
      } catch (error) {
        console.error('💥 Failed to load background:', error);
        canvas.renderAll();
      }
    };

    loadBackgroundImage();
  }, [file, canvasInitialized, fitToScreen]);

  // Update vector overlay when toggle changes
  useEffect(() => {
    if (!fabricRef.current || !hasVectorData || vectorPaths.length === 0) return;
    
    const canvas = fabricRef.current;
    
    // Remove existing overlays
    const overlayObjects = canvas.getObjects().filter(obj => obj.name === 'vectorPathOverlay');
    overlayObjects.forEach(obj => canvas.remove(obj));
    
    // Add new overlays if enabled
    if (showVectorOverlay) {
      renderVectorPathOverlay(canvas, vectorPaths, true);
    } else {
      canvas.renderAll();
    }
  }, [showVectorOverlay, vectorPaths, hasVectorData]);

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

  const clearMeasurements = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // Remove all measurement objects but keep background image
    const objects = canvas.getObjects();
    objects.forEach(obj => {
      if (obj.name !== 'backgroundImage') {
        canvas.remove(obj);
      }
    });
    
    setMeasurements([]);
    calibrationRef.current = {
      isCalibrated: false,
      pixelsPerUnit: null,
      unit: 'mm',
      referenceLine: null
    };
    canvas.renderAll();
  };

  const undoLastMeasurement = () => {
    if (measurements.length === 0 && !calibrationRef.current.referenceLine) return;
    
    const canvas = fabricRef.current;
    
    if (measurements.length > 0) {
      // Remove regular measurement
      const lastMeasurement = measurements[measurements.length - 1];
      canvas.remove(lastMeasurement.line);
      canvas.remove(lastMeasurement.text);
      setMeasurements(prev => prev.slice(0, -1));
    } else if (calibrationRef.current.referenceLine) {
      // Remove calibration - this will reset everything
      resetCalibration();
      return;
    }
    
    canvas.renderAll();
  };

  // Calibration Modal Component
  const CalibrationModal = () => {
    const [realMeasurement, setRealMeasurement] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('mm');

    const handleSubmit = (e) => {
      e.preventDefault();
      const value = parseFloat(realMeasurement);
      if (value && value > 0) {
        completeCalibration(value, selectedUnit);
      }
    };

    const handleCancel = () => {
      // Remove the pending calibration line
      if (pendingCalibration) {
        const canvas = fabricRef.current;
        canvas.remove(pendingCalibration.line);
        canvas.remove(pendingCalibration.text);
        canvas.renderAll();
      }
      setShowCalibrationModal(false);
      setPendingCalibration(null);
    };

    if (!showCalibrationModal || !pendingCalibration) return null;

  return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6 w-full max-w-md">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
            <h3 className="text-lg font-medium text-white">Calibration Setup</h3>
      </div>
          
        <div className="space-y-4">
            <div className="text-sm text-gray-300">
              <p>You've drawn a line of <strong>{pendingCalibration.pixelDistance.toFixed(0)} pixels</strong>.</p>
              <p className="mt-2">What is the real-world measurement of this line?</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
          <div>
                <label className="block text-sm text-gray-300 mb-2">Real Measurement</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={realMeasurement}
                  onChange={(e) => setRealMeasurement(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-orange-500 focus:outline-none"
                  placeholder="e.g., 100"
                  autoFocus
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-2">Unit</label>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-orange-500 focus:outline-none"
                >
                  <option value="mm">Millimeters (mm)</option>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="m">Meters (m)</option>
                  <option value="in">Inches (in)</option>
                  <option value="ft">Feet (ft)</option>
                  <option value="yd">Yards (yd)</option>
                  <option value="km">Kilometers (km)</option>
                  <option value="px">Pixels (px)</option>
                  <option value="units">Generic Units</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 text-sm bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors font-medium"
                >
                  Set Calibration
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
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
            <p className="text-sm mt-1">Switch to visible canvas mode to use the measurement tool.</p>
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
              style={{ 
                maxWidth: '100%', 
                maxHeight: '100%', 
                cursor: isDrawing ? 'crosshair' : isDragging ? 'grabbing' : 'crosshair'
              }}
            />
            
            {/* Drawing state indicator */}
            {isDrawing && startPoint && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
                Drawing Line...
              </div>
            )}
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

          {/* Instructions */}
          {canvasInitialized && hasValidFile && !isWholeFileMode && (
            <div className="absolute bottom-4 left-4 z-10 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
              {!calibrationRef.current.isCalibrated ? (
                <>
                  <p><strong>🎯 Step 1: Calibration</strong></p>
                  <p>Click and drag to draw a line on a known measurement</p>
                  {hasVectorData && (
                    <p className="text-green-300 text-xs mt-1">✨ Vector snapping enabled - lines will snap to PDF paths</p>
                  )}
                </>
              ) : (
                <>
                  <p><strong>📏 Ready to Measure</strong></p>
                  <p>Click and drag to draw lines - measurements will appear automatically</p>
                  <p className="text-green-300 text-xs mt-1">✓ Calibrated: 1 pixel = {(1/calibrationRef.current.pixelsPerUnit).toFixed(4)} {calibrationRef.current.unit}</p>
                  {hasVectorData && snapEnabled && (
                    <p className="text-purple-300 text-xs mt-1">🎯 Snapping to vector paths ({snapDistance}px)</p>
                  )}
                </>
              )}
              <p className="text-gray-300 text-xs mt-2">Hold <kbd className="bg-white/20 px-1 rounded">Alt</kbd> + drag to pan • Mouse wheel to zoom</p>
              {!toolPanelExpanded && (
                <p className="mt-1 text-xs opacity-75">Click panel in top-left to expand</p>
              )}
            </div>
          )}
        </div>

        {/* Floating Measurement Tool Panel */}
        <div className={`absolute top-4 left-4 z-20 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl transition-all duration-300 ${
          toolPanelExpanded ? 'w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto' : 'w-auto'
        }`}>
          {/* Panel Header - Always Visible */}
          <div className="p-3 border-b border-gray-600/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <h3 className="text-sm font-medium text-white">Measurement Tool</h3>
                {!calibrationRef.current.isCalibrated && (
                  <span className="px-2 py-1 bg-orange-600 text-orange-100 text-xs rounded-full">
                    <FaRuler className="inline w-3 h-3 mr-1" />
                    Need Calibration
                  </span>
                )}
                {calibrationRef.current.isCalibrated && (
                  <span className="px-2 py-1 bg-green-600 text-green-100 text-xs rounded-full">
                    <FaRuler className="inline w-3 h-3 mr-1" />
                    {calibrationRef.current.unit}
                  </span>
                )}
                {measurements.length > 0 && (
                  <span className="px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full">
                    {measurements.length}
                  </span>
                )}
                {currentFileIsPdf && (
                  <span className="px-2 py-1 bg-emerald-600 text-emerald-100 text-xs rounded-full" title="Enhanced PDF rendering active">
                    ✨ PDF
                  </span>
                )}
                {hasVectorData && (
                  <span className="px-2 py-1 bg-purple-600 text-purple-100 text-xs rounded-full" title="Vector paths detected - snapping available">
                    🎯 Snap
                  </span>
                )}
                {isPdfFile(file) && !hasVectorData && (
                  <span className="px-2 py-1 bg-gray-600 text-gray-100 text-xs rounded-full" title="Image-based PDF - no vector snapping">
                    📝 Raster
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1">
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
                        Measurement tool works with image/PDF files.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calibration Status */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2 flex items-center">
                  <FaCog className="mr-2" />
                  Calibration Status
                </h4>
                <div className="space-y-2">
                  {!calibrationRef.current.isCalibrated ? (
                    <div className="text-xs bg-orange-900/40 border border-orange-600/50 rounded p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-orange-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-orange-200 font-medium">Calibration Required</span>
                      </div>
                      <p className="text-orange-300 text-xs">
                        <strong>Step 1:</strong> Draw a line on a known measurement in your drawing
                      </p>
                      <p className="text-orange-300 text-xs mt-1">
                        <strong>Step 2:</strong> Enter the real-world measurement when prompted
                      </p>
                      <p className="text-orange-300 text-xs mt-1">
                        <strong>Step 3:</strong> All future measurements will be automatically scaled
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs bg-green-900/40 border border-green-600/50 rounded p-3">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-200 font-medium">Calibrated</span>
                      </div>
                      <p className="text-green-300 text-xs">
                        Scale: {calibrationRef.current.pixelsPerUnit?.toFixed(4)} pixels per {calibrationRef.current.unit}
                      </p>
                      <p className="text-green-300 text-xs mt-1">
                        ✓ Ready to measure - draw lines to get real-world measurements
                      </p>
                      <button
                        onClick={resetCalibration}
                        className="mt-2 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors"
                      >
                        Reset Calibration
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Vector Snapping Status */}
              {isPdfFile(file) && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2 flex items-center">
                    🎯 Vector Snapping
                  </h4>
                  <div className="space-y-2">
                    {hasVectorData ? (
                      <div className="text-xs bg-purple-900/40 border border-purple-600/50 rounded p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-purple-200 font-medium">Vector Paths Detected</span>
                        </div>
                        <p className="text-purple-300 text-xs mb-2">
                          Found {vectorPaths.length} drawable paths. Lines will snap to vector elements.
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={snapEnabled}
                                onChange={(e) => setSnapEnabled(e.target.checked)}
                                className="w-3 h-3 text-purple-600 bg-gray-800 border-gray-600 rounded"
                              />
                              <span className="text-purple-300 text-xs">Enable Snapping</span>
                            </label>
                            <div className="flex items-center space-x-1">
                              <input
                                type="range"
                                min="5"
                                max="20"
                                value={snapDistance}
                                onChange={(e) => setSnapDistance(parseInt(e.target.value))}
                                className="w-12 h-1 bg-gray-700 rounded appearance-none cursor-pointer"
                                disabled={!snapEnabled}
                              />
                              <span className="text-purple-300 text-xs">{snapDistance}px</span>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={showVectorOverlay}
                                onChange={(e) => setShowVectorOverlay(e.target.checked)}
                                className="w-3 h-3 text-green-600 bg-gray-800 border-gray-600 rounded"
                              />
                              <span className="text-green-300 text-xs">Show Vector Overlay (Debug)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs bg-gray-900/40 border border-gray-600/50 rounded p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-gray-300 font-medium">Image-Based PDF</span>
                        </div>
                        <p className="text-gray-400 text-xs">
                          No vector paths found. This PDF appears to contain only raster images. Snapping not available.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Measurements List */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  {calibrationRef.current.isCalibrated ? 'Measurements' : 'Step 1: Calibration'}
                </h4>
                <div className="space-y-2">
                  {!calibrationRef.current.isCalibrated ? (
                    <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                      Draw your first line on a known measurement to calibrate the tool.
                    </div>
                  ) : measurements.length === 0 ? (
                    <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                      Tool is calibrated. Draw lines to measure distances.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {measurements.map((measurement, index) => (
                        <div key={measurement.id} className="text-xs bg-blue-900/40 border border-blue-600/50 rounded p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-blue-200">#{index + 1}</span>
                            <span className="text-blue-100 font-medium">
                              {measurement.realMeasurement.toFixed(3)} {measurement.unit}
                            </span>
                          </div>
                          <div className="text-blue-300 text-xs mt-1">
                            {measurement.pixelDistance.toFixed(0)} pixels
                          </div>
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
                  <div className="flex space-x-2">
              <button
                      onClick={() => undoLastMeasurement()}
                      disabled={measurements.length === 0 && !calibrationRef.current.referenceLine}
                      className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                        measurements.length > 0 || calibrationRef.current.referenceLine
                          ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {calibrationRef.current.referenceLine && measurements.length === 0 ? 'Reset Calibration' : 'Undo'}
                    </button>
                    
              <button
                      onClick={() => clearMeasurements()}
                      disabled={measurements.length === 0 && !calibrationRef.current.referenceLine}
                      className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                        measurements.length > 0 || calibrationRef.current.referenceLine
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
          )}
        </div>
      </div>
      <CalibrationModal />
    </div>
  );
};

export default MeasurementTool; 