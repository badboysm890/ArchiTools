const API_URL = 'http://localhost:8080/api';

export const projectService = {
  async createProject(projectData) {
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    return response.json();
  },

  async listProjects() {
    const response = await fetch(`${API_URL}/projects`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    return response.json();
  },

  async getProject(id) {
    const response = await fetch(`${API_URL}/projects/${id}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }

    return response.json();
  },

  async deleteProject(id) {
    const response = await fetch(`${API_URL}/projects/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete project');
    }

    return response.json();
  },
}; 