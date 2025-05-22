import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
      state.error = null;
    },
    setCurrentProject: (state, action) => {
      state.currentProject = action.payload;
      state.error = null;
    },
    addProject: (state, action) => {
      state.projects.push(action.payload);
      state.error = null;
    },
    removeProject: (state, action) => {
      state.projects = state.projects.filter(project => project.id !== action.payload);
      if (state.currentProject?.id === action.payload) {
        state.currentProject = null;
      }
      state.error = null;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setProjects,
  setCurrentProject,
  addProject,
  removeProject,
  setLoading,
  setError,
} = projectsSlice.actions;

export default projectsSlice.reducer; 