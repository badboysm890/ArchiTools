# Extract Tool Drawing Debug Guide

## 🔧 Drawing Issue Fixed - Here's How to Test

I've implemented several fixes for the rectangle drawing functionality:

### ✅ **What I Fixed:**

1. **State Closure Issues**: Used refs to avoid React state closure problems in event handlers
2. **Event Handler Logic**: Fixed mouse event handling with proper refs and debug logging
3. **Canvas Configuration**: Added proper cursor styles and interaction settings
4. **Background Image**: Ensured background doesn't block mouse events
5. **Debug Tools**: Added comprehensive debug buttons and console logging

### 🧪 **How to Test the Drawing:**

1. **Load the Extract Tool**:
   - Select "Extract" from the left sidebar 
   - Load a PDF or image file
   - Wait for green status indicator in tool panel

2. **Test Rectangle Drawing**:
   - Click and drag on the image to draw rectangles
   - Check browser console for debug messages like:
     - `🖱️ Mouse down at: {x: 123, y: 456}`
     - `🎯 Starting rectangle drawing`
     - `📦 Created rectangle at: {x: 123, y: 456}`

3. **Use Debug Tools**:
   - Click the **🔍 Debug** button to see canvas status
   - Click the **🧪 Test** button to add a test rectangle
   - Check console for detailed debug information

### 🔍 **Debug Console Messages:**

When drawing works correctly, you should see:
```
🖱️ Mouse down at: {x: 150, y: 200}
🎯 Starting rectangle drawing
📦 Created rectangle at: {x: 150, y: 200}
🖱️ Mouse up - isDragging: false isDrawing: true
🎯 Ending rectangle drawing
📦 Final rectangle size: {width: 85, height: 60}
✅ Rectangle is large enough, adding to regions
```

### ⚠️ **Troubleshooting Steps:**

If drawing still doesn't work:

1. **Check Console Messages**:
   - Open browser Developer Tools (F12)
   - Go to Console tab
   - Try drawing - do you see mouse event messages?

2. **Test with Debug Button**:
   - Click "🔍 Debug" button
   - Check if canvas is properly initialized
   - Verify background image is loaded

3. **Try Test Rectangle**:
   - Click "🧪 Test" button
   - Does a blue rectangle appear?
   - If yes, canvas works - issue is with mouse events

4. **Check Status Indicators**:
   - Green dot = Ready to draw
   - Yellow dot = Loading
   - Red dot = Issue

### 🎯 **Common Issues and Solutions:**

**Issue**: No mouse events in console
- **Solution**: Background image might be blocking events
- **Test**: Try drawing before loading any file

**Issue**: Mouse events fire but no rectangle appears
- **Solution**: Canvas might not be properly initialized
- **Test**: Use the Test Rectangle button

**Issue**: Rectangle appears but immediately disappears
- **Solution**: Rectangle might be too small (minimum 10x10 pixels)
- **Test**: Draw larger rectangles

**Issue**: Can't see the full PDF
- **Solution**: Use zoom controls or "Fit to Screen" button
- **Note**: PDF scale reduced to 2.0x for better visibility

### 🔧 **Manual Testing Steps:**

1. **Load Extract Tool**: ✓ Tool loads with green status
2. **Load PDF/Image**: ✓ Background image appears
3. **Check Console**: ✓ See "Background image added to canvas"
4. **Test Mouse Events**: ✓ Move mouse over canvas, see console messages
5. **Draw Rectangle**: ✓ Click and drag, see drawing messages
6. **Verify Rectangle**: ✓ Rectangle appears and stays visible
7. **Extract Content**: ✓ Click crop button, see extraction results

### 📋 **Expected Behavior:**

- **Mouse Down**: Console shows mouse coordinates and drawing start
- **Mouse Move**: Rectangle updates in real-time while dragging
- **Mouse Up**: Rectangle finalizes and appears in regions list
- **Small Rectangles**: Automatically removed (< 10x10 pixels)
- **Large Rectangles**: Added to extraction regions list

The drawing functionality should now work correctly with comprehensive debug logging to help identify any remaining issues!

### 🎨 **Visual Feedback:**

- **Crosshair Cursor**: Appears when hovering over canvas
- **Real-time Rectangle**: Updates as you drag
- **Region Counter**: Shows number of drawn rectangles
- **Status Indicators**: Color-coded tool status

Try the tool now and check the console for debug messages. The drawing should work smoothly with all the fixes implemented!