// types/yolo.types.ts
export interface YOLODetection {
  id: string;
  class: string;
  confidence: number;
  bbox: {
    x: number;  // normalized x (0-1)
    y: number;  // normalized y (0-1)
    width: number;  // normalized width (0-1)
    height: number;  // normalized height (0-1)
  };
  timestamp: string;
  feedId: string;
  severity?: 'Low' | 'Medium' | 'High';
  priority?: 'Normal' | 'High' | 'Critical';
  requiresImmediateAction?: boolean;
}

export interface YOLOModel {
  name: string;
  version: string;
  classes: string[];
  inputSize: {
    width: number;
    height: number;
  };
  confidenceThreshold: number;
}

export interface CCTVFeed {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'offline' | 'maintenance';
  streamUrl: string;
  type: 'traffic' | 'public' | 'private' | 'high_risk';
  stats?: {
    fps: number;
    resolution: string;
    detectionsToday: number;
  };
}

export interface DetectionHistory {
  id: string;
  feedId: string;
  feedName: string;
  detection: {
    class: string;
    confidence: number;
    severity?: string;
  };
  timestamp: string;
  acknowledged: boolean;
}