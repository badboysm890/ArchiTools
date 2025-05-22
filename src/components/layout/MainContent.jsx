import React, { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FaTimes } from 'react-icons/fa';
import FileViewer from '../viewers/FileViewer';
import MeasurementTool from '../tools/MeasurementTool';
import { setCurrentFile, setComparisonFile, closeCurrentFile, closeComparisonFile, clearFiles } from '../../store/slices/filesSlice';
import { setSplitView, setOverlayView } from '../../store/slices/uiSlice';
import EmptyState from '../common/EmptyState';

const FileTabs = ({ files, activeFile, comparisonFile, onSelect, onClose }) => {
  if (!files || files.length === 0) return null;

  return (
    <div className="flex items-center space-x-1 px-2 py-1 bg-smortr-bg border-b border-smortr-border overflow-x-auto" role="tablist" aria-label="Open files">
      {files.map((file, index) => (
        <div
          key={file.path}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-t cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-smortr-accent card-pop ${
            file.path === activeFile?.path
              ? 'bg-smortr-hover text-smortr-text shadow-smortr-lg' :
            file.path === comparisonFile?.path
              ? 'bg-smortr-accent/20 text-smortr-text' :
              'text-smortr-text-secondary hover:text-smortr-text hover:bg-smortr-hover/50'
          }`}
          tabIndex={0}
          role="tab"
          aria-selected={file.path === activeFile?.path}
          aria-label={`Open file ${file.name}`}
          onClick={() => onSelect(file)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(file); }}
        >
          <span className="truncate max-w-xs">{file.name}</span>
          <button
            className="p-0.5 rounded-full hover:bg-smortr-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-smortr-accent"
            onClick={(e) => {
              e.stopPropagation();
              onClose(file);
            }}
            aria-label={`Close file ${file.name}`}
          >
            <FaTimes className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

const MainContent = () => {
  const dispatch = useDispatch();
  const { splitView, overlayView } = useSelector(state => state.ui);
  const { currentFile, comparisonFile, recentFiles } = useSelector(state => state.files);
  const { activeTool } = useSelector(state => state.tools);

  // Centralized sync state
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncScale, setSyncScale] = useState(1);
  const [syncPosition, setSyncPosition] = useState({ x: 0, y: 0 });
  // Track which viewer is the sync master
  const [syncMaster, setSyncMaster] = useState('main'); // 'main' or 'comparison'

  // Debug logs
  const handleSyncEnabledChange = useCallback((enabled) => {
    setSyncEnabled(enabled);
  }, []);
  const handleSyncScaleChange = useCallback((scale) => {
    setSyncScale(scale);
  }, []);
  const handleSyncPositionChange = useCallback((pos) => {
    setSyncPosition(pos);
  }, []);

  const handleTabSelect = (file) => {
    if (!currentFile) {
      dispatch(setCurrentFile(file));
    } else if (file.path === currentFile.path) {
      return;
    } else if (file.path === comparisonFile?.path) {
      dispatch(setComparisonFile(currentFile));
      dispatch(setCurrentFile(file));
    } else {
      if (splitView || overlayView) {
        dispatch(setComparisonFile(file));
      } else {
        dispatch(setCurrentFile(file));
      }
    }
  };

  const handleTabClose = (file) => {
    if (file.path === currentFile?.path) {
      dispatch(closeCurrentFile());
      if (comparisonFile) {
        dispatch(setCurrentFile(comparisonFile));
        dispatch(setComparisonFile(null));
      }
      if (!comparisonFile) {
        dispatch(setSplitView(false));
        dispatch(setOverlayView(false));
      }
    } else if (file.path === comparisonFile?.path) {
      dispatch(closeComparisonFile());
      dispatch(setSplitView(false));
      dispatch(setOverlayView(false));
    }
  };

  const renderContent = (file, isComparisonView = false) => {
    if (!file) return (
      <EmptyState
        illustration="file"
        title="No file selected"
        description="Select a file from the file manager or upload a new one to get started."
      />
    );

    if (activeTool === 'measure') {
      return <MeasurementTool file={file} />;
    }
    return (
      <FileViewer
        file={file}
        isComparisonView={isComparisonView}
        syncEnabled={syncEnabled}
        setSyncEnabled={handleSyncEnabledChange}
        syncScale={syncScale}
        setSyncScale={handleSyncScaleChange}
        syncPosition={syncPosition}
        setSyncPosition={handleSyncPositionChange}
        syncMaster={syncMaster}
        setSyncMaster={setSyncMaster}
      />
    );
  };

  const activeTabs = [
    ...(currentFile ? [currentFile] : []),
    ...(comparisonFile ? [comparisonFile] : []),
    ...recentFiles.filter(f => 
      f.path !== currentFile?.path && 
      f.path !== comparisonFile?.path
    )
  ].slice(0, 5);

  const noFilesOpen = !currentFile && !comparisonFile;

  return (
    <div className="flex-1 bg-smortr-bg overflow-hidden flex flex-col">
      <FileTabs
        files={activeTabs}
        activeFile={currentFile}
        comparisonFile={comparisonFile}
        onSelect={handleTabSelect}
        onClose={handleTabClose}
      />
      <div className="flex-1 flex relative">
        {noFilesOpen ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              illustration="file"
              title="No files open"
              description="Open or upload a file to get started."
            />
          </div>
        ) : (
          <>
            {/* Left Document Panel */}
            <div className={`flex-1 ${overlayView ? 'relative' : ''} fade-in`}>
              {renderContent(currentFile)}
            </div>
            {/* Right Document Panel (for split/overlay view) */}
            {(splitView || overlayView) && comparisonFile && (
              <div 
                className={`flex-1 ${
                  overlayView 
                    ? 'absolute inset-0 bg-smortr-bg/50 fade-in' 
                    : 'border-l border-smortr-border fade-in'
                }`}
              >
                {renderContent(comparisonFile, true)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MainContent; 