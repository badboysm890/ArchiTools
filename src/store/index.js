import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import filesReducer from './slices/filesSlice';
import toolsReducer from './slices/toolsSlice';
import uiReducer from './slices/uiSlice';
import projectsReducer from './slices/projectsSlice';
import chatReducer from './slices/chatSlice';

const filesPersistConfig = {
  key: 'files',
  storage,
  whitelist: ['fileTree', 'selectedFolder']
};

const toolsPersistConfig = {
  key: 'tools',
  storage,
  whitelist: ['toolSettings']
};

const uiPersistConfig = {
  key: 'ui',
  storage,
  whitelist: ['theme']
};

const projectsPersistConfig = {
  key: 'projects',
  storage,
  whitelist: ['projects', 'currentProject']
};

const chatPersistConfig = {
  key: 'chat',
  storage,
  whitelist: ['messages', 'suggestedPrompts']
};

export const store = configureStore({
  reducer: {
    files: persistReducer(filesPersistConfig, filesReducer),
    tools: persistReducer(toolsPersistConfig, toolsReducer),
    ui: persistReducer(uiPersistConfig, uiReducer),
    projects: persistReducer(projectsPersistConfig, projectsReducer),
    chat: persistReducer(chatPersistConfig, chatReducer)
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export const persistor = persistStore(store); 