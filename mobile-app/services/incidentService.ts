import axios from 'axios';

const API_URL = 'http://192.168.137.1:5000/api/incidents';

export const reportIncident = async (imageUri: string, location: any, description: string) => {
  const formData = new FormData();
  
  // 1. ምስሉን ማዘጋጀት
  const filename = imageUri.split('/').pop();
  const match = /\.(\w+)$/.exec(filename || '');
  const type = match ? `image/${match[1]}` : `image`;

  formData.append('image', { uri: imageUri, name: filename, type } as any);
  
  // 2. የቦታ እና የገለጻ መረጃዎችን መጨመር [cite: 36, 38]
  formData.append('latitude', location.coords.latitude.toString());
  formData.append('longitude', location.coords.longitude.toString());
  formData.append('description', description);

  // 3. ወደ ባክ-ኤንድ መላክ [cite: 39]
  return axios.post(API_URL, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};