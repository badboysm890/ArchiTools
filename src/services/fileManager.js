const API_URL = 'http://localhost:8080/api';

export const fileManagerService = {
  async listFiles(path = '.', projectId) {
    const response = await fetch(`${API_URL}/files?path=${path}&projectId=${projectId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }

    return response.json();
  },

  async uploadFile(file, path = '.', projectId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('path', path);

    const response = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    return response.json();
  },

  getDownloadUrl(path, projectId) {
    return `${API_URL}/files/content?path=${encodeURIComponent(path)}&projectId=${projectId}`;
  },

  async deleteFile(path, projectId) {
    const response = await fetch(`${API_URL}/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, projectId }),
    });
    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
    return response.json();
  },

  async renameFile(oldPath, newPath, projectId) {
    const response = await fetch(`${API_URL}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath, projectId }),
    });
    if (!response.ok) {
      throw new Error('Failed to rename file');
    }
    return response.json();
  },
}; 