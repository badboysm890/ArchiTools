/**
 * Grid Annotation Service - Handles parsing and highlighting of grid cell references in chat responses
 */

class GridAnnotationService {
  constructor() {
    this.subscribers = new Map(); // Component subscribers for grid highlighting
    this.clickListenerSetup = false; // Track if global click listener is set up
  }

  /**
   * Parse grid cell references from text content
   * Looks for patterns like "Cell 1", "cell 3", "cells 1-4", "Cell 2-5", etc.
   */
  parseGridCellReferences(text) {
    if (!text || typeof text !== 'string') return [];

    const cellReferences = [];
    const processedRanges = new Set(); // Track processed text ranges to avoid overlaps
    
    // Pattern 1: Cell ranges - "cells 1-4", "Cell 2-5", etc. (process first to avoid conflicts)
    const rangeCellPattern = /\bcells?\s+(\d+)[-–—]\s*(\d+)\b/gi;
    let match;
    
    while ((match = rangeCellPattern.exec(text)) !== null) {
      const startCell = parseInt(match[1]);
      const endCell = parseInt(match[2]);
      const cells = [];
      
      for (let i = startCell; i <= endCell; i++) {
        cells.push(i);
      }
      
      const ref = {
        type: 'range',
        cells: cells,
        text: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      };
      
      cellReferences.push(ref);
      processedRanges.add(`${ref.startIndex}-${ref.endIndex}`);
    }

    // Pattern 2: Multiple cells - "cells 1, 3, 5", etc.
    const multipleCellPattern = /\bcells?\s+((?:\d+(?:\s*,\s*\d+)+(?:\s*(?:and|&)\s*\d+)?|\d+\s*(?:and|&)\s*\d+))/gi;
    
    while ((match = multipleCellPattern.exec(text)) !== null) {
      const isOverlapping = Array.from(processedRanges).some(range => {
        const [start, end] = range.split('-').map(Number);
        return (match.index >= start && match.index < end) || 
               (match.index + match[0].length > start && match.index + match[0].length <= end);
      });
      
      if (!isOverlapping) {
        const cellsText = match[1];
        const cellNumbers = cellsText.match(/\d+/g)?.map(num => parseInt(num)) || [];
        
        if (cellNumbers.length > 1) {
          const ref = {
            type: 'multiple',
            cells: cellNumbers,
            text: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length
          };
          
          cellReferences.push(ref);
          processedRanges.add(`${ref.startIndex}-${ref.endIndex}`);
        }
      }
    }
    
    // Pattern 3: Single cells - "Cell 1", "cell 3", etc. (process last to avoid conflicts)
    const singleCellPattern = /\bcell\s+(\d+)\b/gi;
    
    while ((match = singleCellPattern.exec(text)) !== null) {
      const isOverlapping = Array.from(processedRanges).some(range => {
        const [start, end] = range.split('-').map(Number);
        return (match.index >= start && match.index < end) || 
               (match.index + match[0].length > start && match.index + match[0].length <= end);
      });
      
      if (!isOverlapping) {
        const cellId = parseInt(match[1]);
        const ref = {
          type: 'single',
          cells: [cellId],
          text: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        };
        
        cellReferences.push(ref);
        processedRanges.add(`${ref.startIndex}-${ref.endIndex}`);
      }
    }

    return cellReferences.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Set up global click listener for grid cell references
   */
  setupClickListeners() {
    if (this.clickListenerSetup || typeof window === 'undefined') {
      return;
    }

    console.log('Setting up global click listeners for grid cell references');

    // Add global click listener for grid cell references
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked element is a grid cell reference
      if (target && target.classList && target.classList.contains('clickable-grid-cell')) {
        const cellsData = target.getAttribute('data-cells');
        if (cellsData) {
          event.preventDefault();
          this.handleCellClick(cellsData);
        }
      }
    });

    this.clickListenerSetup = true;
  }

  /**
   * Highlight text with clickable grid cell references
   */
  highlightGridReferences(text, onCellClick) {
    // Skip if text already contains grid cell references to avoid double processing
    if (text.includes('grid-cell-reference')) {
      console.log('Text already contains grid references, skipping processing');
      return text;
    }
    
    // Set up click listeners if not already done
    this.setupClickListeners();
    
    const references = this.parseGridCellReferences(text);
    
    if (references.length === 0) {
      return text;
    }

    console.log(`Found ${references.length} grid cell references to highlight`);

    let highlightedText = text;
    
    // Process references in reverse order to maintain correct indices
    references.reverse().forEach(ref => {
      const beforeText = highlightedText.substring(0, ref.startIndex);
      const afterText = highlightedText.substring(ref.endIndex);
      
      // Escape HTML attributes properly
      const cellsData = ref.cells.join(',');
      const cellsList = ref.cells.join(', ');
      const escapedText = ref.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      // Create span with data attributes and CSS classes (no inline onclick)
      const clickableSpan = `<span class="grid-cell-reference clickable-grid-cell" data-cells="${cellsData}" title="Click to highlight grid cells: ${cellsList}">${escapedText}</span>`;
      
      highlightedText = beforeText + clickableSpan + afterText;
    });

    console.log('Grid cell references processed successfully');
    return highlightedText;
  }

  /**
   * Subscribe a component to grid highlighting events
   */
  subscribe(id, callback) {
    this.subscribers.set(id, callback);
  }

  /**
   * Unsubscribe a component from grid highlighting events
   */
  unsubscribe(id) {
    this.subscribers.delete(id);
  }

  /**
   * Handle cell click events from highlighted text
   */
  handleCellClick(cellsString) {
    console.log('🟦 GRID ANNOTATION SERVICE: Grid cell clicked:', cellsString);
    
    const cells = cellsString.split(',').map(cell => parseInt(cell.trim())).filter(cell => !isNaN(cell));
    
    if (cells.length === 0) {
      console.warn('⚠️ GRID ANNOTATION SERVICE: No valid cell IDs found in:', cellsString);
      return;
    }
    
    console.log('🚀 GRID ANNOTATION SERVICE: Notifying subscribers about cells:', cells);
    console.log(`   📡 Number of subscribers: ${this.subscribers.size}`);
    
    // Notify all subscribers about the cell click
    this.subscribers.forEach((callback, id) => {
      try {
        console.log(`   🔔 Notifying subscriber "${id}" with cells:`, cells);
        callback(cells);
        console.log(`   ✅ Successfully notified subscriber "${id}"`);
      } catch (error) {
        console.warn(`❌ Error notifying subscriber ${id}:`, error);
      }
    });
    
    console.log('🎯 GRID ANNOTATION SERVICE: Cell click processing complete');
  }

  /**
   * Create structured count analysis from response text
   */
  parseCountAnalysis(text) {
    if (!text || typeof text !== 'string') return null;

    const analysis = {
      gridCells: [],
      totalCount: null,
      summary: '',
      rawText: text
    };

    // Look for grid cell analysis pattern
    const cellAnalysisPattern = /(?:Cell\s+(\d+):\s*(\d+)\s*items?\s*found\s*[-–—]?\s*([^\n\r]*?)(?=\n|$|Cell\s+\d+:))/gi;
    let match;

    while ((match = cellAnalysisPattern.exec(text)) !== null) {
      const cellId = parseInt(match[1]);
      const count = parseInt(match[2]);
      const description = match[3].trim();

      analysis.gridCells.push({
        cellId,
        count,
        description
      });
    }

    // Look for total count
    const totalPattern = /(?:Total\s*Count|Total):\s*(\d+)/i;
    const totalMatch = text.match(totalPattern);
    if (totalMatch) {
      analysis.totalCount = parseInt(totalMatch[1]);
    }

    // Look for summary
    const summaryPattern = /(?:Summary):\s*([^\n\r]*)/i;
    const summaryMatch = text.match(summaryPattern);
    if (summaryMatch) {
      analysis.summary = summaryMatch[1].trim();
    }

    return analysis;
  }

  /**
   * Format grid analysis for display
   */
  formatGridAnalysis(analysis) {
    if (!analysis || !analysis.gridCells.length) return null;

    return {
      cellResults: analysis.gridCells,
      totalCount: analysis.totalCount,
      summary: analysis.summary,
      hasStructuredData: true
    };
  }
}

// Create and export singleton instance
const gridAnnotationService = new GridAnnotationService();

// Make available globally for debugging and legacy support
if (typeof window !== 'undefined') {
  window.gridAnnotationService = gridAnnotationService;
}

export default gridAnnotationService; 