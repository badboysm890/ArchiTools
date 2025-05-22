import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentFile: null,
  comparisonFile: null,
  recentFiles: [], // Keep track of recently opened files
  fileTree: [],
  selectedFolder: null,
  loading: false,
  error: null
};

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setCurrentFile: (state, action) => {
      state.currentFile = action.payload;
      if (action.payload) {
        state.recentFiles = [action.payload, ...state.recentFiles.filter(f => f.path !== action.payload.path)].slice(0, 10);
      }
    },
    setComparisonFile: (state, action) => {
      state.comparisonFile = action.payload;
      if (action.payload) {
        state.recentFiles = [action.payload, ...state.recentFiles.filter(f => f.path !== action.payload.path)].slice(0, 10);
      }
    },
    closeCurrentFile: (state) => {
      // Add current file to recent files if it exists
      if (state.currentFile) {
        state.recentFiles = [state.currentFile, ...state.recentFiles.filter(f => f.path !== state.currentFile.path)].slice(0, 10);
      }
      state.currentFile = null;
    },
    closeComparisonFile: (state) => {
      // Add comparison file to recent files if it exists
      if (state.comparisonFile) {
        state.recentFiles = [state.comparisonFile, ...state.recentFiles.filter(f => f.path !== state.comparisonFile.path)].slice(0, 10);
      }
      state.comparisonFile = null;
    },
    swapFiles: (state) => {
      const temp = state.currentFile;
      state.currentFile = state.comparisonFile;
      state.comparisonFile = temp;
    },
    clearFiles: (state) => {
      // Add both files to recent files if they exist
      if (state.currentFile) {
        state.recentFiles = [state.currentFile, ...state.recentFiles.filter(f => f.path !== state.currentFile.path)].slice(0, 10);
      }
      if (state.comparisonFile) {
        state.recentFiles = [state.comparisonFile, ...state.recentFiles.filter(f => f.path !== state.comparisonFile.path)].slice(0, 10);
      }
      state.currentFile = null;
      state.comparisonFile = null;
    },
    setFileTree: (state, action) => {
      state.fileTree = action.payload;
    },
    setSelectedFolder: (state, action) => {
      state.selectedFolder = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const {
  setCurrentFile,
  setComparisonFile,
  closeCurrentFile,
  closeComparisonFile,
  swapFiles,
  clearFiles,
  setFileTree,
  setSelectedFolder,
  setLoading,
  setError,
  clearError
} = filesSlice.actions;

export default filesSlice.reducer; 