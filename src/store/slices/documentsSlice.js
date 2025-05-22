import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  documents: [],
  activeDocument: null,
  comparisonDocument: null,
  recentDocuments: [],
  documentVersions: {},
  annotations: {},
};

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    addDocument: (state, action) => {
      state.documents.push(action.payload);
      if (!state.activeDocument) {
        state.activeDocument = action.payload.id;
      }
      // Add to recent documents
      state.recentDocuments = [
        action.payload.id,
        ...state.recentDocuments.filter(id => id !== action.payload.id)
      ].slice(0, 10);
    },
    setActiveDocument: (state, action) => {
      state.activeDocument = action.payload;
      // Update recent documents
      state.recentDocuments = [
        action.payload,
        ...state.recentDocuments.filter(id => id !== action.payload)
      ].slice(0, 10);
    },
    setComparisonDocument: (state, action) => {
      state.comparisonDocument = action.payload;
    },
    addAnnotation: (state, action) => {
      const { documentId, annotation } = action.payload;
      if (!state.annotations[documentId]) {
        state.annotations[documentId] = [];
      }
      state.annotations[documentId].push(annotation);
    },
    addDocumentVersion: (state, action) => {
      const { documentId, version } = action.payload;
      if (!state.documentVersions[documentId]) {
        state.documentVersions[documentId] = [];
      }
      state.documentVersions[documentId].push(version);
    },
    removeDocument: (state, action) => {
      state.documents = state.documents.filter(doc => doc.id !== action.payload);
      if (state.activeDocument === action.payload) {
        state.activeDocument = state.documents[0]?.id || null;
      }
      if (state.comparisonDocument === action.payload) {
        state.comparisonDocument = null;
      }
      // Remove from recent documents
      state.recentDocuments = state.recentDocuments.filter(id => id !== action.payload);
    },
  },
});

export const {
  addDocument,
  setActiveDocument,
  setComparisonDocument,
  addAnnotation,
  addDocumentVersion,
  removeDocument,
} = documentsSlice.actions;

export default documentsSlice.reducer; 