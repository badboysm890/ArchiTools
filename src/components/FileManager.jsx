import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fileManagerService } from '../services/fileManager';
import { projectService } from '../services/projectService';
import { FaFolder, FaFile, FaUpload, FaPlus, FaImage, FaFileAlt, FaFilePdf, FaFileCode } from 'react-icons/fa';
import { setProjects, setCurrentProject, addProject, setLoading as setProjectsLoading, setError as setProjectsError } from '../store/slices/projectsSlice';
import { setCurrentFile, setComparisonFile } from '../store/slices/filesSlice';
import { setSplitView } from '../store/slices/uiSlice';
import FileRow from './common/FileRow';
import Breadcrumb from './common/Breadcrumb';
import SkeletonLoader from './common/SkeletonLoader';
import EmptyState from './common/EmptyState';

const FileManager = () => {
  const dispatch = useDispatch();
  const { projects = [], currentProject = null, loading: projectsLoading = false, error: projectsError = null } = useSelector(state => state.projects || {});
  const { currentFile, comparisonFile } = useSelector(state => state.files);
  const { splitView } = useSelector(state => state.ui);
  const [currentPath, setCurrentPath] = useState('.');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const fileListRef = React.useRef();
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadFiles(currentPath);
    } else {
      setFiles([]);
    }
  }, [currentProject, currentPath]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!files.length || !fileListRef.current) return;
      if (document.activeElement !== fileListRef.current) return;
      if (e.key === 'ArrowDown') {
        setFocusedIndex((prev) => Math.min(prev + 1, files.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < files.length) {
          handleFileClick(files[focusedIndex], { button: 0 });
        }
        e.preventDefault();
      }
    };
    fileListRef.current?.addEventListener('keydown', handleKeyDown);
    return () => fileListRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [files, focusedIndex]);

  const loadProjects = async () => {
    try {
      dispatch(setProjectsLoading(true));
      const projectList = await projectService.listProjects();
      dispatch(setProjects(projectList || []));
    } catch (err) {
      dispatch(setProjectsError('Failed to load projects'));
      console.error(err);
    } finally {
      dispatch(setProjectsLoading(false));
    }
  };

  const loadFiles = async (path) => {
    if (!currentProject) return;
    
    try {
      setLoading(true);
      setError(null);
      const fileList = await fileManagerService.listFiles(path, currentProject.id);
      setFiles(fileList || []);
    } catch (err) {
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBreadcrumbNavigate = (path) => {
    setCurrentPath(path);
  };

  const handleFileAction = async (action, file) => {
    if (!currentProject) return;
    try {
      if (action === 'delete') {
        if (!window.confirm(`Delete ${file.name}?`)) return;
        await fileManagerService.deleteFile(file.path, currentProject.id);
        loadFiles(currentPath);
      } else if (action === 'rename') {
        const newName = window.prompt('Enter new name:', file.name);
        if (!newName || newName === file.name) return;
        const newPath = file.path.replace(/[^/]+$/, newName);
        await fileManagerService.renameFile(file.path, newPath, currentProject.id);
        loadFiles(currentPath);
      } else if (action === 'download') {
        const url = fileManagerService.getDownloadUrl(file.path, currentProject.id);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(`Failed to ${action} file`);
      console.error(err);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      dispatch(setProjectsLoading(true));
      const newProject = await projectService.createProject({
        name: newProjectName,
        description: newProjectDescription,
      });
      
      if (newProject) {
        dispatch(addProject(newProject));
        dispatch(setCurrentProject(newProject));
        setIsCreatingProject(false);
        setNewProjectName('');
        setNewProjectDescription('');
        // Reload projects to ensure we have the latest data
        loadProjects();
      }
    } catch (err) {
      dispatch(setProjectsError('Failed to create project'));
      console.error(err);
    } finally {
      dispatch(setProjectsLoading(false));
    }
  };

  // Returns a string type for a file based on extension/type
  const getFileType = (file) => {
    if (file.type === 'folder') return 'folder';
    const extension = file.name.split('.').pop()?.toLowerCase();
    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const codeTypes = ['js', 'jsx', 'ts', 'tsx', 'html', 'css'];
    if (imageTypes.includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    if (extension === 'txt' || extension === 'md') return 'text';
    if (codeTypes.includes(extension)) return 'code';
    return 'unknown';
  };

  const handleFileClick = async (file, event) => {
    if (file.type === 'folder') {
      setCurrentPath(file.path);
      return;
    }

    const fileUrl = fileManagerService.getDownloadUrl(file.path, currentProject.id);
    const fileType = getFileType(file);
    
    const fileData = {
      name: file.name,
      path: file.path,
      type: fileType,
      url: fileUrl,
      projectId: currentProject.id
    };

    // Right-click to open in comparison view
    if (event.button === 2) {
      dispatch(setComparisonFile(fileData));
      if (!splitView) {
        dispatch(setSplitView(true));
      }
      return;
    }

    // Shift+click to open in comparison view
    if (event.shiftKey) {
      dispatch(setComparisonFile(fileData));
      if (!splitView) {
        dispatch(setSplitView(true));
      }
      return;
    }

    // Normal click - open in main view
    dispatch(setCurrentFile(fileData));
  };

  const handleUpload = async (event) => {
    if (!currentProject) return;
    
    const files = event.target.files;
    if (!files.length) return;

    try {
      setLoading(true);
      for (const file of files) {
        await fileManagerService.uploadFile(file, currentPath, currentProject.id);
      }
      loadFiles(currentPath);
    } catch (err) {
      setError('Failed to upload files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateUp = () => {
    if (currentPath === '.') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '.';
    setCurrentPath(parentPath);
  };

  // Drag & drop upload
  const handleDrop = async (e) => {
    e.preventDefault();
    if (!currentProject) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (!droppedFiles.length) return;
    try {
      setLoading(true);
      for (const file of droppedFiles) {
        await fileManagerService.uploadFile(file, currentPath, currentProject.id);
      }
      loadFiles(currentPath);
    } catch (err) {
      setError('Failed to upload files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (projectsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-smortr-accent"></div>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-500">{projectsError}</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-smortr-bg text-smortr-text p-4">
      {/* Project Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <select
            value={currentProject?.id || ''}
            onChange={(e) => {
              const project = (projects || []).find(p => p.id === e.target.value);
              dispatch(setCurrentProject(project || null));
              setCurrentPath('.');
            }}
            className="flex-1 mr-4 bg-smortr-bg text-smortr-text rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-smortr-accent border border-smortr-border"
          >
            <option value="">Select a project</option>
            {(projects || []).map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsCreatingProject(true)}
            className="px-3 py-2 bg-smortr-accent text-white rounded hover:bg-smortr-accent/90 flex items-center space-x-2"
          >
            <FaPlus />
            <span>Project</span>
          </button>
        </div>

        {/* Create Project Form */}
        {isCreatingProject && (
          <form onSubmit={handleCreateProject} className="mb-4 p-4 bg-smortr-hover rounded">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-smortr-bg text-smortr-text rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-smortr-accent border border-smortr-border"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full bg-smortr-bg text-smortr-text rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-smortr-accent border border-smortr-border"
                  rows="3"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-4 py-2 text-smortr-text-secondary hover:text-smortr-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-smortr-accent text-white rounded hover:bg-smortr-accent/90"
                >
                  Create Project
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {currentProject ? (
        <>
          {/* Breadcrumb and Actions */}
          <div className="flex items-center justify-between mb-4">
            <Breadcrumb path={currentPath} onNavigate={handleBreadcrumbNavigate} />
            <label className="flex items-center space-x-2 px-3 py-1.5 bg-smortr-accent text-white rounded cursor-pointer hover:bg-smortr-accent/90">
              <FaUpload />
              <span>Upload</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>

          {/* File List with glassy-bg and drag & drop */}
          <div
            className="glassy-bg p-2 min-h-[200px] max-h-[60vh] overflow-y-auto"
            style={{ minHeight: 200 }}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={handleDrop}
            tabIndex={0}
            ref={fileListRef}
            role="listbox"
            aria-label="File list"
          >
            {loading ? (
              <SkeletonLoader rows={6} />
            ) : error ? (
              <div className="text-red-500 text-center py-4">{error}</div>
            ) : (files || []).length === 0 ? (
              <EmptyState illustration="folder" title="No files in this directory" description="Upload files or create folders to get started." />
            ) : (
              <div className="space-y-1">
                {(files || []).map((file, idx) => (
                  <FileRow
                    key={file.path}
                    file={file}
                    isActive={currentFile?.path === file.path}
                    isComparison={comparisonFile?.path === file.path}
                    onClick={e => handleFileClick(file, e)}
                    onContextMenu={e => { e.preventDefault(); handleFileClick(file, { button: 2 }); }}
                    onAction={handleFileAction}
                    aria-selected={focusedIndex === idx}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <EmptyState illustration="folder" title="Select or create a project" description="Choose a project to view and manage its files." />
      )}
    </div>
  );
};

export default FileManager; 