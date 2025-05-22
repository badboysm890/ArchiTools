import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { FaFolder, FaFile, FaFileAlt, FaFilePdf, FaFileImage, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { fileService } from '../../services/fileService';
import { setCurrentFile, setLoading, setError } from '../../store/slices/filesSlice';
import EmptyState from '../common/EmptyState';

const FileItem = ({ item, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState([]);
  const dispatch = useDispatch();

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf': return <FaFilePdf className="text-red-500" />;
      case 'txt': return <FaFileAlt className="text-gray-500" />;
      case 'image': return <FaFileImage className="text-blue-500" />;
      default: return <FaFile className="text-smortr-text-secondary" />;
    }
  };

  const handleFolderClick = async () => {
    try {
      if (!isOpen && item.type === 'folder') {
        const files = await fileService.listFiles(item.path);
        setChildren(files);
      }
      setIsOpen(!isOpen);
    } catch (error) {
      dispatch(setError(error.message));
    }
  };

  const handleFileClick = async () => {
    try {
      dispatch(setLoading(true));
      const url = fileService.getFileUrl(item.path);
      dispatch(setCurrentFile({
        name: item.name,
        type: item.type,
        url: url
      }));
    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  if (item.type === 'folder') {
    return (
      <div className={`mb-1 ml-${level * 2} card-light shadow-smortr transition-all`}>
        <button
          className="w-full flex items-center gap-2 py-2 px-3 rounded-xl group hover:bg-smortr-hover transition focus:outline-none focus-visible:ring-2 focus-visible:ring-smortr-accent"
          onClick={handleFolderClick}
          aria-label={`Toggle folder ${item.name}`}
          tabIndex={0}
        >
          {isOpen ? <FaChevronDown className="w-4 h-4 text-smortr-accent-2" /> : <FaChevronRight className="w-4 h-4 text-smortr-accent-2" />}
          <FaFolder className="w-5 h-5 text-smortr-accent" />
          <span className="font-semibold text-base text-smortr-text flex-1 text-left">{item.name}</span>
          <span className="text-xs text-smortr-text-secondary">{isOpen ? 'Hide' : 'Show'}</span>
        </button>
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          aria-hidden={!isOpen}
        >
          {isOpen && (
            <div className="pl-4 border-l border-smortr-border ml-2 mt-1">
              {children.length === 0 ? (
                <EmptyState illustration="folder" title="Empty folder" description="There are no files or folders here." />
              ) : (
                children.map((child, idx) => (
                  <FileItem key={idx} item={child} level={level + 1} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-1 ml-${level * 2} card-light shadow-smortr flex items-center gap-3 py-2 px-3 hover:shadow-smortr-lg transition-all group`}> 
      <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={handleFileClick} tabIndex={0} role="button" aria-label={`Open file ${item.name}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleFileClick(); }}>
        {getFileIcon(item.type)}
        <span className="font-medium text-smortr-text truncate">{item.name}</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button className="icon-btn focus:outline-none focus-visible:ring-2 focus-visible:ring-smortr-accent" title="Open" aria-label={`Open file ${item.name}`} onClick={handleFileClick}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H3m0 0l4-4m-4 4l4 4" /></svg>
        </button>
        <button className="icon-btn focus:outline-none focus-visible:ring-2 focus-visible:ring-smortr-accent" title="Download" aria-label={`Download file ${item.name}`} onClick={e => { e.stopPropagation(); window.open(fileService.getFileUrl(item.path), '_blank'); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
        </button>
      </div>
    </div>
  );
};

const RightSidebar = () => {
  const [files, setFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoadingState] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoadingState(true);
      dispatch(setLoading(true));
      const data = await fileService.listFiles();
      setFiles(data);
    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      setLoadingState(false);
      dispatch(setLoading(false));
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      dispatch(setLoading(true));
      await fileService.uploadFile(file);
      await loadFiles(); // Refresh file list
    } catch (error) {
      dispatch(setError(error.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-80 bg-smortr-sidebar border-l border-smortr-border h-full overflow-y-auto flex flex-col shadow-smortr">
      <div className="p-6 space-y-6">
        {/* File Manager Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-smortr-text">File Manager</h2>
          <label className="icon-btn bg-smortr-accent-2 text-white hover:bg-smortr-accent-3 transition cursor-pointer ripple">
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.txt,.csv"
            />
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </label>
        </div>
        {/* Search Bar */}
        <div className="card mb-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="input w-full"
          />
        </div>
        {/* File Tree */}
        <div className="card space-y-1 max-h-[60vh] overflow-y-auto" role="tree" aria-label="File tree">
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 w-full skeleton mb-2" />
              ))}
            </>
          ) : filteredFiles.length === 0 ? (
            <EmptyState illustration="file" title="No files found" description="Try uploading or creating a new file." />
          ) : (
            filteredFiles.map((item, index) => (
              <FileItem key={index} item={item} />
            ))
          )}
        </div>
      </div>
      {/* Floating Action Button for Upload */}
      <label className="fab cursor-pointer ripple">
        <input
          type="file"
          className="hidden"
          onChange={handleUpload}
          accept=".pdf,.txt,.csv"
        />
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </label>
    </aside>
  );
};

export default RightSidebar; 