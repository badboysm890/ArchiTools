import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

const MeasurementTool = ({ file, scale = 1 }) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const [measurements, setMeasurements] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  useEffect(() => {
    // Initialize fabric canvas
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      selection: false
    });

    const canvas = fabricRef.current;

    // Load image if provided
    if (file?.url) {
      fabric.Image.fromURL(file.url, (img) => {
        canvas.setWidth(img.width);
        canvas.setHeight(img.height);
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
      });
    }

    // Event listeners
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.dispose();
    };
  }, [file]);

  const handleMouseDown = (event) => {
    if (!isDrawing) {
      setIsDrawing(true);
      const pointer = fabricRef.current.getPointer(event.e);
      setStartPoint({ x: pointer.x, y: pointer.y });
    }
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || !startPoint) return;

    const canvas = fabricRef.current;
    const pointer = canvas.getPointer(event.e);

    // Remove previous line if exists
    const objects = canvas.getObjects();
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1]);
    }

    // Draw new line
    const line = new fabric.Line([
      startPoint.x,
      startPoint.y,
      pointer.x,
      pointer.y
    ], {
      stroke: '#0066CC',
      strokeWidth: 2,
      selectable: false
    });

    canvas.add(line);

    // Calculate and display measurement
    const distance = Math.sqrt(
      Math.pow(pointer.x - startPoint.x, 2) +
      Math.pow(pointer.y - startPoint.y, 2)
    );

    const text = new fabric.Text(
      `${(distance * scale).toFixed(2)} units`,
      {
        left: (startPoint.x + pointer.x) / 2,
        top: (startPoint.y + pointer.y) / 2,
        fontSize: 14,
        fill: '#FFFFFF',
        backgroundColor: '#0066CC',
        padding: 5,
        selectable: false
      }
    );

    canvas.add(text);
    canvas.renderAll();
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const objects = fabricRef.current.getObjects();
      if (objects.length >= 2) {
        const line = objects[objects.length - 2];
        const text = objects[objects.length - 1];
        setMeasurements([
          ...measurements,
          {
            distance: parseFloat(text.text),
            points: [
              { x: line.x1, y: line.y1 },
              { x: line.x2, y: line.y2 }
            ]
          }
        ]);
      }
    }
  };

  const clearMeasurements = () => {
    fabricRef.current.clear();
    if (file?.url) {
      fabric.Image.fromURL(file.url, (img) => {
        fabricRef.current.setBackgroundImage(
          img,
          fabricRef.current.renderAll.bind(fabricRef.current)
        );
      });
    }
    setMeasurements([]);
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
      <div className="w-64 bg-smortr-sidebar border-l border-smortr-border p-4">
        <div className="space-y-4">
          <div>
            <h3 className="text-smortr-text font-medium mb-2">Measurements</h3>
            <div className="space-y-2">
              {measurements.map((m, index) => (
                <div
                  key={index}
                  className="text-sm text-smortr-text-secondary bg-smortr-hover rounded p-2"
                >
                  Distance: {m.distance.toFixed(2)} units
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-smortr-text font-medium mb-2">Settings</h3>
            <div className="space-y-2">
              <button
                onClick={clearMeasurements}
                className="w-full bg-smortr-hover text-smortr-text-secondary hover:text-smortr-text px-4 py-2 rounded transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeasurementTool; 