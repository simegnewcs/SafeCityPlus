// services/yoloDetectionService.ts
import { YOLODetection, YOLOModel, CCTVFeed, DetectionHistory } from '../types/yolo.types';

// Simulated YOLO model configuration
export const yoloModel: YOLOModel = {
  name: 'YOLOv8',
  version: '8.0.1',
  classes: [
    'person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle',
    'fire', 'smoke', 'accident', 'medical_emergency', 'fight',
    'weapon', 'crowd', 'flood', 'fire_extinguisher', 'police'
  ],
  inputSize: { width: 640, height: 640 },
  confidenceThreshold: 0.5
};

// Simulate YOLO detection with bounding boxes
export const simulateYOLODetection = (feedId: string): YOLODetection[] => {
  const detections: YOLODetection[] = [];
  const numDetections = Math.floor(Math.random() * 5) + 1; // 1-5 detections per frame

  // Different detection profiles based on camera location
  const feedProfiles: { [key: string]: string[] } = {
    'cam_001': ['car', 'truck', 'person', 'accident'], // Bole Road - traffic focus
    'cam_002': ['fire', 'smoke', 'person', 'crowd'],   // Piassa - fire detection
    'cam_003': ['person', 'medical_emergency', 'crowd'], // Merkato - people focus
    'cam_004': ['car', 'motorcycle', 'person', 'accident'], // Mexico Square
    'cam_005': ['person', 'crowd', 'fight', 'weapon']   // High-risk area
  };

  const possibleClasses = feedProfiles[feedId] || yoloModel.classes;

  for (let i = 0; i < numDetections; i++) {
    const randomClass = possibleClasses[Math.floor(Math.random() * possibleClasses.length)];
    const confidence = 0.65 + Math.random() * 0.3; // 0.65 - 0.95
    
    // Generate random bounding box
    const x = Math.random() * 0.7 + 0.15; // 15-85% of width
    const y = Math.random() * 0.7 + 0.15; // 15-85% of height
    const width = 0.1 + Math.random() * 0.2; // 10-30% of frame width
    const height = 0.15 + Math.random() * 0.25; // 15-40% of frame height

    const detection: YOLODetection = {
      id: `det_${Date.now()}_${i}`,
      class: randomClass,
      confidence: parseFloat(confidence.toFixed(2)),
      bbox: {
        x: x - width / 2,
        y: y - height / 2,
        width,
        height
      },
      timestamp: new Date().toISOString(),
      feedId
    };

    // Add specific attributes based on detection class
    if (randomClass === 'fire' || randomClass === 'smoke') {
      detection.severity = confidence > 0.8 ? 'High' : 'Medium';
      detection.priority = confidence > 0.8 ? 'Critical' : 'High';
    } else if (randomClass === 'accident' || randomClass === 'medical_emergency') {
      detection.severity = 'High';
      detection.priority = 'Critical';
    } else if (randomClass === 'fight' || randomClass === 'weapon') {
      detection.severity = 'High';
      detection.priority = 'Critical';
      detection.requiresImmediateAction = true;
    }

    detections.push(detection);
  }

  return detections.sort((a, b) => b.confidence - a.confidence);
};

// Generate color for bounding box based on detection class
export const getDetectionColor = (className: string): string => {
  const colorMap: { [key: string]: string } = {
    'fire': '#FF4444',
    'smoke': '#888888',
    'accident': '#FF6B6B',
    'medical_emergency': '#4ECDC4',
    'fight': '#FFA500',
    'weapon': '#FF0000',
    'person': '#00FF00',
    'car': '#4169E1',
    'truck': '#4169E1',
    'bus': '#4169E1',
    'motorcycle': '#9370DB',
    'bicycle': '#9370DB',
    'crowd': '#FFD700',
    'flood': '#00CED1',
    'fire_extinguisher': '#32CD32',
    'police': '#1E90FF'
  };

  return colorMap[className] || '#FFFFFF';
};

// Simulate CCTV feeds with different locations
export const mockCCTVFeeds: CCTVFeed[] = [
  {
    id: 'cam_001',
    name: 'Bole Road - Intersection',
    location: 'Bole, Addis Ababa',
    status: 'active',
    streamUrl: 'https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?q=80&w=2070',
    type: 'traffic',
    stats: {
      fps: 30,
      resolution: '1080p',
      detectionsToday: 156
    }
  },
  {
    id: 'cam_002',
    name: 'Piassa - Main Square',
    location: 'Piassa, Addis Ababa',
    status: 'active',
    streamUrl: 'https://images.unsplash.com/photo-1576495199011-eb94736d05d6?q=80&w=2070',
    type: 'public',
    stats: {
      fps: 25,
      resolution: '720p',
      detectionsToday: 89
    }
  },
  {
    id: 'cam_003',
    name: 'Merkato - Gate A',
    location: 'Merkato, Addis Ababa',
    status: 'active',
    streamUrl: 'https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?q=80&w=2070',
    type: 'public',
    stats: {
      fps: 30,
      resolution: '1080p',
      detectionsToday: 234
    }
  },
  {
    id: 'cam_004',
    name: 'Mexico Square',
    location: 'Mexico, Addis Ababa',
    status: 'active',
    streamUrl: 'https://images.unsplash.com/photo-1581006852262-4c7a5e2c6196?q=80&w=2070',
    type: 'traffic',
    stats: {
      fps: 30,
      resolution: '1080p',
      detectionsToday: 67
    }
  },
  {
    id: 'cam_005',
    name: 'Kazanchis - High Risk Zone',
    location: 'Kazanchis, Addis Ababa',
    status: 'active',
    streamUrl: 'https://images.unsplash.com/photo-1581092335951-83b6585b7c7b?q=80&w=2070',
    type: 'high_risk',
    stats: {
      fps: 30,
      resolution: '4K',
      detectionsToday: 312
    }
  }
];

// Detection history for timeline
export const detectionHistory: DetectionHistory[] = [
  {
    id: 'hist_001',
    feedId: 'cam_001',
    feedName: 'Bole Road',
    detection: {
      class: 'accident',
      confidence: 0.94,
      severity: 'High'
    },
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    acknowledged: false
  },
  {
    id: 'hist_002',
    feedId: 'cam_002',
    feedName: 'Piassa',
    detection: {
      class: 'fire',
      confidence: 0.91,
      severity: 'High'
    },
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(), // 12 min ago
    acknowledged: true
  },
  {
    id: 'hist_003',
    feedId: 'cam_003',
    feedName: 'Merkato',
    detection: {
      class: 'medical_emergency',
      confidence: 0.85,
      severity: 'Medium'
    },
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(), // 25 min ago
    acknowledged: false
  }
];