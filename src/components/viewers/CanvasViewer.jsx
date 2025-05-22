import React, { useEffect, useRef, useState } from 'react';
import { FaSearchPlus, FaSearchMinus, FaExpandArrowsAlt, FaCompress, FaLink, FaUnlink } from 'react-icons/fa';

const CanvasViewer = ({ file, isComparisonView = false, syncEnabled, setSyncEnabled, syncScale, setSyncScale, syncPosition, setSyncPosition, syncMaster, setSyncMaster }) => {
  // Log received sync props
  const viewerId = isComparisonView ? 'comparison' : 'main';
  console.log(`[CanvasViewer] ${isComparisonView ? 'Comparison' : 'Main'} View Props: syncEnabled=${syncEnabled}, syncScale=${syncScale}, syncPosition=`, syncPosition, 'syncMaster=', syncMaster);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // Local state for when sync is disabled
  const [localScale, setLocalScale] = useState(1);
  const [localPosition, setLocalPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [image, setImage] = useState(null);
  const [fitToScreen, setFitToScreen] = useState(true);
  const lastImageUrlRef = useRef(null);
  const fitPerformedRef = useRef(false);

  // Load image when file changes
  useEffect(() => {
    if (!file?.url) return;
    const img = new Image();
    img.src = file.url;
    img.onload = () => {
      setImage(img);
      if (fitToScreen) {
        fitImageToScreen(img);
      }
    };
  }, [file]);

  // When image changes, reset fitPerformedRef
  useEffect(() => {
    if (file?.url !== lastImageUrlRef.current) {
      fitPerformedRef.current = false;
      lastImageUrlRef.current = file?.url;
    }
  }, [file?.url]);

  // When sync is enabled, use shared state; when disabled, use local state
  const scale = syncEnabled ? syncScale : localScale;
  const position = syncEnabled ? syncPosition : localPosition;

  // When sync state changes, update local state to match shared state
  useEffect(() => {
    if (syncEnabled) {
      setLocalScale(syncScale);
      setLocalPosition(syncPosition);
    }
  }, [syncEnabled, syncScale, syncPosition]);

  // Fit image to screen, but only once per image
  const fitImageToScreen = (img) => {
    if (!containerRef.current || !img) return;
    if (fitPerformedRef.current) return; // Prevent repeated fit
    fitPerformedRef.current = true;

    const container = containerRef.current;
    const containerRatio = container.clientWidth / container.clientHeight;
    const imageRatio = img.width / img.height;
    let newScale;
    if (containerRatio > imageRatio) {
      newScale = container.clientHeight / img.height;
    } else {
      newScale = container.clientWidth / img.width;
    }
    newScale *= 0.9;

    setSyncMaster(viewerId);

    // Only update if different
    if (syncEnabled && syncMaster === viewerId) {
      if (syncScale !== newScale) setSyncScale(newScale);
      const newPos = {
        x: (container.clientWidth - img.width * newScale) / 2,
        y: (container.clientHeight - img.height * newScale) / 2
      };
      if (syncPosition.x !== newPos.x || syncPosition.y !== newPos.y) setSyncPosition(newPos);
    } else if (!syncEnabled) {
      setLocalScale(newScale);
      setLocalPosition({
        x: (container.clientWidth - img.width * newScale) / 2,
        y: (container.clientHeight - img.height * newScale) / 2
      });
    }
    console.log('[CanvasViewer] Fit to screen, scale:', newScale);
  };

  // Draw image
  const drawImage = () => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  };

  // Mouse events for dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    setSyncMaster(viewerId); // Set this viewer as master on drag
    console.log('[CanvasViewer] Drag start', e.clientX, e.clientY);
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newPosition = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };
    if (syncEnabled && syncMaster === viewerId) {
      setSyncPosition(newPosition);
    } else if (!syncEnabled) {
      setLocalPosition(newPosition);
    }
    console.log('[CanvasViewer] Drag move', newPosition);
  };
  const handleMouseUp = () => {
    setIsDragging(false);
    console.log('[CanvasViewer] Drag end');
  };

  // Zoom controls
  const handleZoom = (delta) => {
    const newScale = Math.max(0.1, Math.min(5, scale + delta));
    setSyncMaster(viewerId); // Set this viewer as master on zoom
    if (syncEnabled && syncMaster === viewerId) {
      setSyncScale(newScale);
    } else if (!syncEnabled) {
      setLocalScale(newScale);
    }
    console.log('[CanvasViewer] Zoom', newScale);
  };

  const toggleFitToScreen = () => {
    setFitToScreen(!fitToScreen);
    if (!fitToScreen) {
      fitImageToScreen(image);
    }
    setSyncMaster(viewerId); // Set this viewer as master on fit toggle
    console.log('[CanvasViewer] Toggle fit to screen', !fitToScreen);
  };

  const toggleSync = () => {
    setSyncEnabled(!syncEnabled);
    setSyncMaster(viewerId); // Set this viewer as master on sync toggle
    console.log('[CanvasViewer] Toggle sync', !syncEnabled);
  };

  // Update canvas when container size changes
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (fitToScreen) {
        fitImageToScreen(image);
      }
      drawImage();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [image, fitToScreen]);

  // Draw image whenever scale or position changes
  useEffect(() => {
    drawImage();
  }, [scale, position.x, position.y, image]);

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {/* Zoom controls and sync toggle */}
      <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-smortr-bg/90 rounded-lg p-2 shadow-lg">
        {isComparisonView && (
          <button
            className={`p-2 rounded transition-colors ${
              syncEnabled 
                ? 'bg-smortr-accent text-white' 
                : 'bg-smortr-hover text-smortr-text-secondary'
            }`}
            onClick={toggleSync}
            title={syncEnabled ? "Disable Sync" : "Enable Sync"}
          >
            {syncEnabled ? <FaLink className="w-4 h-4" /> : <FaUnlink className="w-4 h-4" />}
          </button>
        )}
        <button
          className="p-2 hover:bg-smortr-hover rounded"
          onClick={() => handleZoom(0.1)}
          title="Zoom In"
        >
          <FaSearchPlus className="w-4 h-4 text-smortr-text" />
        </button>
        <button
          className="p-2 hover:bg-smortr-hover rounded"
          onClick={() => handleZoom(-0.1)}
          title="Zoom Out"
        >
          <FaSearchMinus className="w-4 h-4 text-smortr-text" />
        </button>
        <button
          className="p-2 hover:bg-smortr-hover rounded"
          onClick={toggleFitToScreen}
          title={fitToScreen ? "Free Mode" : "Fit to Screen"}
        >
          {fitToScreen ? (
            <FaExpandArrowsAlt className="w-4 h-4 text-smortr-text" />
          ) : (
            <FaCompress className="w-4 h-4 text-smortr-text" />
          )}
        </button>
        <div className="px-2 text-sm text-smortr-text-secondary">
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
};

export default CanvasViewer; 