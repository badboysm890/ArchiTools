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
      state.messages.push(action.payload);
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
  },
});

export const {
  addMessage,
  setTyping,
  addSuggestedPrompt,
  removeSuggestedPrompt,
  updateContext,
  clearMessages,
  addRecentAction,
} = chatSlice.actions;

export default chatSlice.reducer; 