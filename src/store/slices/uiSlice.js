import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  splitView: false,
  overlayView: false,
  theme: 'dark'
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSplitView: (state, action) => {
      const newSplitView = action.payload;
      // If turning off split view, also turn off overlay view
      if (!newSplitView) {
        state.overlayView = false;
      }
      // If turning on split view, turn off overlay view
      else if (newSplitView) {
        state.overlayView = false;
      }
      state.splitView = newSplitView;
    },
    setOverlayView: (state, action) => {
      const newOverlayView = action.payload;
      // If turning off overlay view, also turn off split view
      if (!newOverlayView) {
        state.splitView = false;
      }
      // If turning on overlay view, turn off split view
      else if (newOverlayView) {
        state.splitView = false;
      }
      state.overlayView = newOverlayView;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    }
  }
});

export const {
  setSplitView,
  setOverlayView,
  setTheme
} = uiSlice.actions;

export default uiSlice.reducer; 