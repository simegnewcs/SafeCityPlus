import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseUrl = () => {
    const IP = '192.168.137.1';
    const PORT = '5000';
    
    if (Platform.OS === 'android') {
        return `http://${IP}:${PORT}/api`;
    } else if (Platform.OS === 'ios') {
        return `http://${IP}:${PORT}/api`;
    } else {
        return `http://localhost:${PORT}/api`;
    }
};

const API_BASE_URL = getBaseUrl();

console.log('📱 API Base URL:', API_BASE_URL);

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use(
    async (config) => {
        try {
            const isGuest = await AsyncStorage.getItem('isGuest');
            const userData = await AsyncStorage.getItem('userData');
            
            console.log('🔐 Auth check - isGuest:', isGuest, 'userData:', userData ? 'exists' : 'none');
            
            if (isGuest !== 'true' && userData) {
                const user = JSON.parse(userData);
                config.headers.Authorization = `Bearer ${user.id}`;
                console.log('✅ Auth token added for user:', user.id, user.fullName);
            } else {
                console.log('👤 No auth token (guest mode or no user)');
            }
        } catch (error) {
            console.error('Error getting token:', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        console.log(`✅ API Success: ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error('❌ API Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        return Promise.reject(error);
    }
);

// Check if user is guest
export const isGuestMode = async () => {
    try {
        const guest = await AsyncStorage.getItem('isGuest');
        return guest === 'true';
    } catch (error) {
        return false;
    }
};

// Auth API
export const authAPI = {
    register: async (data: { fullName: string; phone: string; password: string }) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
    
    login: async (phone: string, password: string) => {
        const response = await api.post('/auth/login', { phone, password });
        console.log('Login response:', response.data);
        
        if (response.data.success && response.data.user) {
            await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
            await AsyncStorage.setItem('userToken', response.data.user.id.toString());
            await AsyncStorage.setItem('isLoggedIn', 'true');
            await AsyncStorage.removeItem('isGuest');
            console.log('✅ User data saved, ID:', response.data.user.id);
        }
        return response.data;
    },
    
    logout: async () => {
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('isLoggedIn');
        console.log('✅ Logged out');
    },
    
    getCurrentUser: async () => {
        const userData = await AsyncStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }
};

// Incident API
export const incidentAPI = {
    reportIncident: async (imageUri: string, location: any, description: string, mediaType: string = 'image') => {
        const formData = new FormData();
        
        // Get filename and extension
        const filename = imageUri.split('/').pop() || 'media.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const fileExtension = match ? match[1] : (mediaType === 'video' ? 'mp4' : 'jpg');
        
        // Determine mime type
        let mimeType;
        if (mediaType === 'video') {
            mimeType = `video/${fileExtension === 'mp4' ? 'mp4' : 'quicktime'}`;
        } else {
            mimeType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
        }
        
        console.log(`📎 Preparing ${mediaType} file:`, {
            uri: imageUri,
            filename,
            mimeType,
            mediaType
        });
        
        // Append media file
        formData.append('image', {
            uri: imageUri,
            name: filename,
            type: mimeType,
        } as any);
        
        // Append metadata
        formData.append('latitude', location.coords.latitude.toString());
        formData.append('longitude', location.coords.longitude.toString());
        formData.append('description', description);
        formData.append('mediaType', mediaType);
        
        console.log('📸 Reporting incident with:', {
            imageUri,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            description,
            mediaType
        });
        
        const response = await api.post('/incidents', formData, {
            headers: { 
                'Content-Type': 'multipart/form-data',
            },
            timeout: 60000 // Longer timeout for videos
        });
        
        console.log('✅ Report response:', response.data);
        return response.data;
    },
    
    getAllIncidents: async () => {
        const response = await api.get('/incidents');
        return response.data;
    },
    
    getIncidentById: async (id: number) => {
        const response = await api.get(`/incidents/${id}`);
        return response.data;
    },
    
    getUserIncidents: async () => {
        const isGuest = await isGuestMode();
        if (isGuest) {
            console.log('👤 Guest mode - no user reports');
            return [];
        }
        
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
            const user = JSON.parse(userData);
            console.log(`📋 Fetching reports for user: ${user.id} (${user.fullName})`);
            const response = await api.get(`/incidents/user/${user.id}`);
            return response.data;
        }
        return [];
    },
    
    getMyIncidents: async () => {
        const isGuest = await isGuestMode();
        if (isGuest) {
            console.log('👤 Guest mode - no user reports');
            return [];
        }
        
        const response = await api.get('/incidents/my');
        return response.data;
    },
    
    updateIncidentStatus: async (id: number, data: { status: string; assigned_responder_id?: number }) => {
        const response = await api.put(`/incidents/${id}`, data);
        return response.data;
    },
    
    getIncidentStats: async () => {
        const response = await api.get('/incidents/stats');
        return response.data;
    }
};

// Default export for backward compatibility
export const reportIncident = incidentAPI.reportIncident;
export default incidentAPI;