import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTool: null,
  toolSettings: {
    measure: {
      scale: 1,
      unit: 'mm'
    }
  }
};

const toolsSlice = createSlice({
  name: 'tools',
  initialState,
  reducers: {
    setActiveTool: (state, action) => {
      state.activeTool = action.payload;
    },
    updateToolSettings: (state, action) => {
      const { tool, settings } = action.payload;
      state.toolSettings[tool] = {
        ...state.toolSettings[tool],
        ...settings
      };
    },
    clearActiveTool: (state) => {
      state.activeTool = null;
    }
  }
});

export const {
  setActiveTool,
  updateToolSettings,
  clearActiveTool
} = toolsSlice.actions;

export default toolsSlice.reducer; 