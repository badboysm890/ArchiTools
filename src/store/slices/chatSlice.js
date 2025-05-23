import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],
  isTyping: false,
  suggestedPrompts: [
    'Explain the wall construction details',
    'What are the dimensions of the store room?',
    'Compare the changes between versions',
  ],
  context: {
    activeDocument: null,
    selectedElements: [],
    recentActions: [],
  },
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      const message = action.payload;
      
      // Ensure message has required properties
      if (!message.id || !message.role) {
        console.warn('Invalid message format:', message);
        return;
      }
      
      // Check if message with this ID already exists (for streaming updates)
      const existingIndex = state.messages.findIndex(m => m.id === message.id);
      
      if (existingIndex !== -1) {
        // Update existing message
        state.messages[existingIndex] = { ...state.messages[existingIndex], ...message };
      } else {
        // Add new message only if it doesn't already exist
        state.messages.push(message);
      }
      
      // Deduplicate messages if any duplicates exist
      const seenIds = new Set();
      state.messages = state.messages.filter(msg => {
        if (seenIds.has(msg.id)) {
          console.warn('Removing duplicate message with ID:', msg.id);
          return false;
        }
        seenIds.add(msg.id);
        return true;
      });
    },
    updateMessage: (state, action) => {
      const { id, ...updates } = action.payload;
      const messageIndex = state.messages.findIndex(m => m.id === id);
      
      if (messageIndex !== -1) {
        state.messages[messageIndex] = {
          ...state.messages[messageIndex],
          ...updates
        };
      }
    },
    setTyping: (state, action) => {
      state.isTyping = action.payload;
    },
    addSuggestedPrompt: (state, action) => {
      if (!state.suggestedPrompts.includes(action.payload)) {
        state.suggestedPrompts.push(action.payload);
      }
    },
    removeSuggestedPrompt: (state, action) => {
      state.suggestedPrompts = state.suggestedPrompts.filter(
        prompt => prompt !== action.payload
      );
    },
    updateContext: (state, action) => {
      state.context = {
        ...state.context,
        ...action.payload,
      };
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    addRecentAction: (state, action) => {
      state.context.recentActions = [
        action.payload,
        ...state.context.recentActions
      ].slice(0, 10);
    },
    deduplicateMessages: (state) => {
      const seenIds = new Set();
      const originalLength = state.messages.length;
      
      state.messages = state.messages.filter(msg => {
        if (seenIds.has(msg.id)) {
          return false;
        }
        seenIds.add(msg.id);
        return true;
      });
      
      if (state.messages.length !== originalLength) {
        console.warn(`Removed ${originalLength - state.messages.length} duplicate messages`);
      }
    },
  },
});

export const {
  addMessage,
  updateMessage,
  setTyping,
  addSuggestedPrompt,
  removeSuggestedPrompt,
  updateContext,
  clearMessages,
  addRecentAction,
  deduplicateMessages,
} = chatSlice.actions;

export default chatSlice.reducer; 