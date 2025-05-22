import axios from 'axios';

const API_URL = 'http://localhost:8080/api';

export const fileService = {
  async listFiles(path = '') {
    try {
      const response = await axios.get(`${API_URL}/files`, {
        params: { path }
      });
      return response.data;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  },

  async getFileContent(path) {
    try {
      const response = await axios.get(`${API_URL}/files/content`, {
        params: { path },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error getting file content:', error);
      throw error;
    }
  },

  async uploadFile(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  getFileUrl(path) {
    return `${API_URL}/files/content?path=${encodeURIComponent(path)}`;
  }
}; 