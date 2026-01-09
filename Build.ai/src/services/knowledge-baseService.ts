// src/services/knowledge-baseService.ts
import axios from 'axios';
import config from 'src/config-global';

export const fetchKnowledgeBaseResponse = async (query: string): Promise<string> => {
  try {
    console.log('Fetching from:', `${config.api_base_url}/knowledge_base`);
    const response = await axios.post(`${config.api_base_url}/knowledge_base`, { query }, {
      responseType: 'text',
    });
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching knowledge base response:', error);
    throw new Error('Failed to fetch knowledge base response');
  }
};

export const uploadKnowledgeBaseDocument = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    console.log('Uploading to:', `${config.api_base_url}/upload_knowledge_base`);
    const response = await axios.post(`${config.api_base_url}/upload_knowledge_base`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'text',
    });

    console.log('Upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw new Error('Failed to upload and process document');
  }
};