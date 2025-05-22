import React from 'react';
import { FaFolder, FaFile, FaImage, FaFileAlt, FaFilePdf, FaFileCode, FaEllipsisV, FaTrash, FaDownload, FaEdit } from 'react-icons/fa';

const getFileIcon = (type) => {
  switch (type) {
    case 'folder':
      return <FaFolder className="text-yellow-500 w-5 h-5" />;
    case 'image':
      return <FaImage className="text-blue-500 w-5 h-5" />;
    case 'pdf':
      return <FaFilePdf className="text-red-500 w-5 h-5" />;
    case 'text':
      return <FaFileAlt className="text-gray-500 w-5 h-5" />;
    case 'code':
      return <FaFileCode className="text-green-500 w-5 h-5" />;
    default:
      return <FaFile className="text-smortr-text-secondary w-5 h-5" />;
  }
};

const FileRow = ({ file, onClick, onContextMenu, onAction, isActive, isComparison }) => {
  const fileType = file.type || 'unknown';
  return (
    <div
      className={`flex items-center space-x-3 p-2 rounded cursor-pointer group transition-all duration-150
        ${isActive ? 'bg-smortr-accent/20' : 'hover:bg-smortr-hover/80'}
        ${isComparison ? 'ring-2 ring-smortr-accent' : ''}
        glassy-bg`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      tabIndex={0}
      role="row"
      aria-selected={isActive}
    >
      {getFileIcon(fileType)}
      <span className="flex-1 truncate">{file.name}</span>
      <div className="hidden group-hover:flex items-center space-x-2 text-smortr-text-secondary">
        <button className="p-1 hover:bg-smortr-hover rounded" title="Rename" onClick={e => { e.stopPropagation(); onAction && onAction('rename', file); }}><FaEdit /></button>
        <button className="p-1 hover:bg-smortr-hover rounded" title="Delete" onClick={e => { e.stopPropagation(); onAction && onAction('delete', file); }}><FaTrash /></button>
        <button className="p-1 hover:bg-smortr-hover rounded" title="Download" onClick={e => { e.stopPropagation(); onAction && onAction('download', file); }}><FaDownload /></button>
      </div>
    </div>
  );
};

export default FileRow; 