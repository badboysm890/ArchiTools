# Extract Tool Setup Guide

The Extract Tool has been successfully implemented and integrated into ArchiTools. Here's what you need to know:

## 🎯 What it does

The Extract Tool allows you to:
- Draw rectangles around content in PDFs or images
- Extract text and tables from selected regions using OCR
- Copy extracted content directly to clipboard for Excel/Sheets
- Automatically detect and format tables for spreadsheet compatibility

## 🚀 How to use

1. **Select the Extract Tool** from the left sidebar (red file export icon)
2. **Load a PDF or image file** in the main viewer
3. **Click and drag** to draw rectangles around content you want to extract
4. **Click the extract button** (crop icon) on each region to process it
5. **Copy to clipboard** using the copy button - tables will be formatted as TSV

## 🔧 Current Status

### ✅ Working Features
- Rectangle drawing and selection
- PDF to image conversion for processing  
- Mock OCR with realistic sample data
- Table detection and formatting
- Clipboard integration with TSV format
- Zoom and pan controls
- Settings panel with customization options

### ⚠️ Troubleshooting

If you're experiencing issues:

1. **Can't see full PDF**: 
   - Use the "Fit to Screen" button (expand arrows icon)
   - Zoom out using mouse wheel or - button
   - The PDF scale has been reduced from 3.0x to 2.0x for better visibility

2. **Tool not working**:
   - Check the status indicator (colored dot) in the tool panel
   - Green = Ready, Yellow = Loading, Red = Issue
   - Make sure a valid image/PDF file is loaded

3. **Can't draw rectangles**:
   - Try the "🧪 Add Test Rectangle" button (visible in development mode)
   - Make sure you're not holding Alt key (which enables panning)
   - Check that the canvas has initialized (status indicator)

## 🔮 OCR Integration (Optional Enhancement)

Currently using mock OCR data. To enable real OCR:

### Option 1: Tesseract.js (Client-side)
Add to your HTML head:
```html
<script src="https://unpkg.com/tesseract.js@4/dist/tesseract.min.js"></script>
```

### Option 2: Cloud OCR APIs
Integrate with:
- Google Cloud Vision API
- AWS Textract  
- Azure Computer Vision
- OpenAI Vision API

## 🎨 Customization

The tool includes these customizable settings:
- Rectangle color (Red, Blue, Green, Orange, Purple)
- Stroke width (1-5px)
- Fill opacity (0-50%)
- Extraction mode (Visible/Whole file - whole file not yet implemented)

## 📋 Output Format

Extracted tables are automatically formatted as Tab-Separated Values (TSV) for easy pasting into:
- Microsoft Excel
- Google Sheets
- Any spreadsheet application

Plain text content is copied as-is to the clipboard.

## 🛠️ Development Notes

- OCR service is modular and easily replaceable
- Fallback mock data provides realistic testing scenarios
- Canvas events properly handle drawing vs. panning modes
- Error handling includes confidence scores and validation
- Component follows existing ArchiTools patterns and styling

The Extract Tool is now ready to use with the current mock OCR system. Real OCR can be added by simply including the Tesseract.js library or configuring a cloud OCR service.