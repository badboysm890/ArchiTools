import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import Papa from 'papaparse';
import { FaTimes, FaExternalLinkAlt, FaDownload, FaExchangeAlt } from 'react-icons/fa';
import { closeCurrentFile, closeComparisonFile, swapFiles } from '../../store/slices/filesSlice';
import CanvasViewer from './CanvasViewer';

// Load PDF.js from CDN
const pdfjsLib = window.pdfjsLib;
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const PDFPreview = ({ file, syncEnabled, setSyncEnabled, syncScale, setSyncScale, syncPosition, setSyncPosition, isComparisonView, syncMaster, setSyncMaster }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only regenerate imageUrl when the file changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setImageUrl(null);

    async function convertPdfToImage() {
      try {
        // Fetch the PDF file
        const response = await fetch(file);
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const url = canvas.toDataURL('image/png');
        if (isMounted) {
          setImageUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Failed to load PDF preview');
          setLoading(false);
        }
      }
    }

    convertPdfToImage();

    return () => {
      isMounted = false;
    };
  }, [file]); // Only when file changes

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-smortr-text-secondary">
        Converting PDF...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full">
      <CanvasViewer
        file={{ url: imageUrl, type: 'image' }}
        syncEnabled={syncEnabled}
        setSyncEnabled={setSyncEnabled}
        syncScale={syncScale}
        setSyncScale={setSyncScale}
        syncPosition={syncPosition}
        setSyncPosition={setSyncPosition}
        isComparisonView={isComparisonView}
        syncMaster={syncMaster}
        setSyncMaster={setSyncMaster}
      />
    </div>
  );
};

const ImageViewer = ({ file, isComparisonView, syncEnabled, setSyncEnabled, syncScale, setSyncScale, syncPosition, setSyncPosition, syncMaster, setSyncMaster }) => {
  return (
    <div className="h-full">
      <CanvasViewer
        file={file}
        syncEnabled={syncEnabled}
        setSyncEnabled={setSyncEnabled}
        syncScale={syncScale}
        setSyncScale={setSyncScale}
        syncPosition={syncPosition}
        setSyncPosition={setSyncPosition}
        isComparisonView={isComparisonView}
        syncMaster={syncMaster}
        setSyncMaster={setSyncMaster}
      />
    </div>
  );
};

const TextViewer = ({ content }) => {
  return (
    <div className="h-full overflow-auto p-4 bg-smortr-bg text-smortr-text font-mono">
      <pre className="whitespace-pre-wrap">{content}</pre>
    </div>
  );
};

const CodeViewer = ({ content, language }) => {
  return (
    <div className="h-full overflow-auto p-4 bg-smortr-bg text-smortr-text font-mono">
      <pre className={`language-${language} whitespace-pre-wrap`}>
        {content}
      </pre>
    </div>
  );
};

const CSVViewer = ({ file }) => {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);

  useEffect(() => {
    if (file) {
      fetch(file)
        .then(response => response.text())
        .then(csvText => {
          Papa.parse(csvText, {
            header: true,
            complete: (results) => {
              setHeaders(results.meta.fields || []);
              setData(results.data || []);
            }
          });
        })
        .catch(error => console.error('Error loading CSV:', error));
    }
  }, [file]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-smortr-text-secondary">
        Loading CSV data...
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-smortr-hover">
            {headers.map((header, index) => (
              <th 
                key={index}
                className="border border-smortr-border px-4 py-2 text-left text-smortr-text"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              className="hover:bg-smortr-hover/50"
            >
              {headers.map((header, colIndex) => (
                <td 
                  key={`${rowIndex}-${colIndex}`}
                  className="border border-smortr-border px-4 py-2 text-smortr-text-secondary"
                >
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FileViewer = ({ file, isComparisonView = false, syncEnabled, setSyncEnabled, syncScale, setSyncScale, syncPosition, setSyncPosition, syncMaster, setSyncMaster }) => {
  const [content, setContent] = useState(null);
  const dispatch = useDispatch();
  // Debug log
  console.log('[FileViewer] isComparisonView:', isComparisonView, 'syncEnabled:', syncEnabled, 'syncScale:', syncScale, 'syncPosition:', syncPosition, 'syncMaster:', syncMaster);

  useEffect(() => {
    if (file && (file.type === 'text' || file.type === 'code')) {
      fetch(file.url)
        .then(response => response.text())
        .then(text => setContent(text))
        .catch(error => console.error('Error loading file content:', error));
    }
  }, [file]);

  const handleClose = () => {
    if (isComparisonView) {
      dispatch(closeComparisonFile());
    } else {
      dispatch(closeCurrentFile());
    }
  };

  const handleSwap = () => {
    dispatch(swapFiles());
  };

  const getViewer = () => {
    if (!file) {
      return (
        <div className="flex items-center justify-center h-full text-smortr-text-secondary">
          Select a file to view
        </div>
      );
    }

    switch (file.type) {
      case 'pdf':
        return <PDFPreview
          file={file.url}
          syncEnabled={syncEnabled}
          setSyncEnabled={setSyncEnabled}
          syncScale={syncScale}
          setSyncScale={setSyncScale}
          syncPosition={syncPosition}
          setSyncPosition={setSyncPosition}
          isComparisonView={isComparisonView}
          syncMaster={syncMaster}
          setSyncMaster={setSyncMaster}
        />;
      case 'image':
        return <ImageViewer 
          file={file} 
          isComparisonView={isComparisonView}
          syncEnabled={syncEnabled}
          setSyncEnabled={setSyncEnabled}
          syncScale={syncScale}
          setSyncScale={setSyncScale}
          syncPosition={syncPosition}
          setSyncPosition={setSyncPosition}
          syncMaster={syncMaster}
          setSyncMaster={setSyncMaster}
        />;
      case 'text':
        return <TextViewer content={content} />;
      case 'code':
        return <CodeViewer content={content} language={file.name.split('.').pop()} />;
      case 'csv':
        return <CSVViewer file={file.url} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-smortr-text-secondary">
            Unsupported file type
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {file && (
        <div className="flex items-center justify-between p-4 border-b border-smortr-border bg-smortr-hover">
          <div className="flex items-center space-x-2">
            <h2 className="text-smortr-text font-medium">{file.name}</h2>
            <span className="text-smortr-text-secondary text-sm">({file.type.toUpperCase()})</span>
          </div>
          <div className="flex items-center space-x-2">
            {isComparisonView && (
              <button 
                className="toolbar-button"
                onClick={handleSwap}
                title="Swap with main view"
              >
                <FaExchangeAlt className="w-4 h-4" />
              </button>
            )}
            <button 
              className="toolbar-button"
              onClick={() => window.open(file.url, '_blank')}
              title="Open in new tab"
            >
              <FaExternalLinkAlt className="w-4 h-4" />
            </button>
            <button 
              className="toolbar-button"
              onClick={() => {
                const link = document.createElement('a');
                link.href = file.url;
                link.download = file.name;
                link.click();
              }}
              title="Download"
            >
              <FaDownload className="w-4 h-4" />
            </button>
            <button 
              className="toolbar-button text-red-500 hover:bg-red-500/10"
              onClick={handleClose}
              title="Close"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {getViewer()}
      </div>
    </div>
  );
};

export default FileViewer; 