// services/mockDataService.ts
import { Incident, AIAnalysis, User, CCTVFeed } from '../types';

// Mock user data
export const mockUser: User = {
  id: 'usr_001',
  fullName: 'Abebe Kebede',
  phone: '+251 912 345 678',
  email: 'abebe.k@email.com',
  role: 'Citizen',
  location: 'Addis Ababa, Ethiopia'
};

// Mock incidents data
export const mockIncidents: Incident[] = [
  {
    id: 'inc_001',
    title: 'Bole Road - Major Car Accident',
    description: 'Multi-vehicle collision near Bole International Airport',
    location: 'Bole Road, Addis Ababa',
    coordinates: { lat: 9.0300, lng: 38.7400 },
    type: 'Car Accident',
    severity: 'High',
    priority: 'Critical',
    status: 'active',
    time: '3 min ago',
    reportedBy: 'AI Detection',
    mediaUrl: 'https://picsum.photos/id/1015/400/300',
    aiAnalysis: {
      confidence: 0.94,
      type: 'Car Accident',
      severity: 'High',
      priority: 'Critical'
    }
  },
  {
    id: 'inc_002',
    title: 'Piassa Market - Fire Emergency',
    description: 'Fire detected in commercial building',
    location: 'Piassa, Addis Ababa',
    coordinates: { lat: 9.0350, lng: 38.7500 },
    type: 'Fire',
    severity: 'High',
    priority: 'Critical',
    status: 'active',
    time: '8 min ago',
    reportedBy: 'Citizen Report',
    mediaUrl: 'https://picsum.photos/id/1043/400/300',
    aiAnalysis: {
      confidence: 0.91,
      type: 'Fire',
      severity: 'High',
      priority: 'Critical'
    }
  },
  {
    id: 'inc_003',
    title: 'Merkato - Medical Emergency',
    description: 'Person collapsed, needs immediate medical attention',
    location: 'Merkato, Addis Ababa',
    coordinates: { lat: 9.0400, lng: 38.7450 },
    type: 'Medical Emergency',
    severity: 'Medium',
    priority: 'High',
    status: 'active',
    time: '14 min ago',
    reportedBy: 'Bystander',
    mediaUrl: 'https://picsum.photos/id/107/400/300',
    aiAnalysis: {
      confidence: 0.85,
      type: 'Medical Emergency',
      severity: 'Medium',
      priority: 'High'
    }
  },
  {
    id: 'inc_004',
    title: 'Mexico Square - Flooding',
    description: 'Street flooding causing traffic disruption',
    location: 'Mexico Square, Addis Ababa',
    coordinates: { lat: 9.0250, lng: 38.7350 },
    type: 'Flooding',
    severity: 'Low',
    priority: 'Normal',
    status: 'monitoring',
    time: '27 min ago',
    reportedBy: 'CCTV Detection',
    mediaUrl: 'https://picsum.photos/id/1044/400/300',
    aiAnalysis: {
      confidence: 0.78,
      type: 'Flooding',
      severity: 'Low',
      priority: 'Normal'
    }
  }
];

// Mock CCTV feeds with AI analysis
export const mockCCTVFeeds: CCTVFeed[] = [
  {
    id: 'cam_001',
    location: 'Bole Road - Intersection',
    status: 'active',
    currentIncident: {
      type: 'Traffic Congestion',
      confidence: 0.88,
      detectedAt: '2 min ago'
    },
    streamUrl: 'https://picsum.photos/id/1015/400/300'
  },
  {
    id: 'cam_002',
    location: 'Piassa - Main Square',
    status: 'active',
    currentIncident: {
      type: 'Fire Detected',
      confidence: 0.91,
      detectedAt: '5 min ago'
    },
    streamUrl: 'https://picsum.photos/id/1043/400/300'
  },
  {
    id: 'cam_003',
    location: 'Merkato - Gate A',
    status: 'active',
    currentIncident: null,
    streamUrl: 'https://picsum.photos/id/107/400/300'
  }
];

// AI Analysis simulation
export const analyzeWithAI = async (imageUri: string): Promise<AIAnalysis> => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const types = ['Car Accident', 'Fire', 'Medical Emergency', 'Fighting', 'Flooding'];
  const severities = ['Low', 'Medium', 'High'];
  const priorities = ['Normal', 'High', 'Critical'];
  
  const randomType = types[Math.floor(Math.random() * types.length)];
  const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
  const randomPriority = randomSeverity === 'High' ? 'Critical' : 
                        randomSeverity === 'Medium' ? 'High' : 'Normal';
  
  return {
    type: randomType,
    confidence: Number((0.7 + Math.random() * 0.25).toFixed(2)),
    severity: randomSeverity,
    priority: randomPriority,
    timestamp: new Date().toISOString()
  };
};

// Generate heatmap data
export const generateHeatmapData = () => {
  return mockIncidents.map(inc => ({
    latitude: inc.coordinates.lat,
    longitude: inc.coordinates.lng,
    weight: inc.severity === 'High' ? 1 : inc.severity === 'Medium' ? 0.6 : 0.3
  }));
};