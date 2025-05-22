import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import toolsReducer from './slices/toolsSlice';
import filesReducer from './slices/filesSlice';
import projectsReducer from './slices/projectsSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    tools: toolsReducer,
    files: filesReducer,
    projects: projectsReducer,
  },
}); 