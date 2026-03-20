// types/index.ts
export interface User {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: 'Citizen' | 'Responder' | 'Admin' | 'Guest';
  location?: string;
  avatar?: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: string;
  severity: 'Low' | 'Medium' | 'High';
  priority: 'Normal' | 'High' | 'Critical';
  status: 'active' | 'resolved' | 'monitoring';
  time: string;
  reportedBy: string;
  mediaUrl?: string;
  aiAnalysis?: AIAnalysis;
}

export interface AIAnalysis {
  type: string;
  confidence: number;
  severity: 'Low' | 'Medium' | 'High';
  priority: 'Normal' | 'High' | 'Critical';
  timestamp?: string;
}

export interface CCTVFeed {
  id: string;
  location: string;
  status: 'active' | 'offline' | 'maintenance';
  currentIncident?: {
    type: string;
    confidence: number;
    detectedAt: string;
  } | null;
  streamUrl: string;
}

export interface Report {
  id: string;
  userId: string;
  type: string;
  description: string;
  mediaUrls: string[];
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  aiAnalysis?: AIAnalysis;
}