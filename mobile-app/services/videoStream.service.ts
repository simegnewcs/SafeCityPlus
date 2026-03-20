// services/videoStream.service.ts
import * as Camera from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { wsService } from './websocket.service';

interface VideoChunk {
  data: string;
  timestamp: number;
  sequence: number;
}

interface AIAnalysis {
  type: string;
  confidence: number;
  severity: 'Low' | 'Medium' | 'High';
  priority: 'Normal' | 'High' | 'Critical';
  description: string;
  timestamp: string;
  frameAnalysis?: {
    objects: Array<{
      class: string;
      confidence: number;
      bbox: number[];
    }>;
  };
}

class VideoStreamService {
  private cameraRef: Camera.Camera | null = null;
  private recording = false;
  private streamInterval: NodeJS.Timeout | null = null;
  private chunkQueue: VideoChunk[] = [];
  private sequence = 0;
  private streamId: string | null = null;
  private onAnalysisCallback: ((analysis: AIAnalysis) => void) | null = null;
  private bufferedChunks: VideoChunk[] = [];
  private readonly MAX_BUFFER_SIZE = 30; // 30 chunks buffer
  private readonly CHUNK_INTERVAL = 1000; // 1 second chunks

  async initializeCamera(): Promise<boolean> {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
    
    return status === 'granted' && audioStatus === 'granted';
  }

  setCameraRef(ref: Camera.Camera) {
    this.cameraRef = ref;
  }

  async startStreaming(userId: string, isGuest: boolean): Promise<string> {
    if (!this.cameraRef) {
      throw new Error('Camera not initialized');
    }

    this.streamId = `stream_${Date.now()}_${userId}`;
    this.recording = true;
    this.sequence = 0;
    this.bufferedChunks = [];

    // Start recording
    const videoRecordPromise = this.cameraRef.recordAsync({
      maxDuration: 300, // 5 minutes max
      quality: Camera.VideoQuality['720p'],
      mute: false,
    });

    // Start chunked streaming
    this.startChunkedStreaming();

    // Handle the full recording for backup
    videoRecordPromise.then((video) => {
      console.log('Recording completed:', video.uri);
      this.uploadCompleteVideo(video.uri);
    });

    // Notify backend about stream start
    wsService.emit('stream_started', {
      streamId: this.streamId,
      userId,
      isGuest,
      timestamp: new Date().toISOString(),
    });

    return this.streamId;
  }

  private startChunkedStreaming() {
    this.streamInterval = setInterval(async () => {
      if (!this.recording || !this.cameraRef) return;

      try {
        // Capture frame for AI analysis
        const photo = await this.cameraRef.takePictureAsync({
          base64: true,
          quality: 0.5,
        });

        // Create video chunk (in real implementation, this would be actual video chunks)
        const chunk: VideoChunk = {
          data: photo.base64!,
          timestamp: Date.now(),
          sequence: this.sequence++,
        };

        // Add to buffer
        this.bufferedChunks.push(chunk);
        if (this.bufferedChunks.length > this.MAX_BUFFER_SIZE) {
          this.bufferedChunks.shift();
        }

        // Send chunk to backend via WebSocket
        wsService.emit('video_chunk', {
          streamId: this.streamId,
          chunk: {
            ...chunk,
            data: chunk.data.substring(0, 1000), // Send partial for demo
          },
        });

        // Trigger AI analysis on this frame
        this.analyzeFrame(photo.base64!);

      } catch (error) {
        console.error('Error streaming chunk:', error);
        this.handleStreamError(error);
      }
    }, this.CHUNK_INTERVAL);
  }

  private async analyzeFrame(base64Image: string) {
    try {
      // Send to AI service via WebSocket for real-time analysis
      wsService.emit('analyze_frame', {
        streamId: this.streamId,
        image: base64Image,
        timestamp: Date.now(),
      });

      // Note: AI analysis results will come back via WebSocket event 'ai_analysis'
    } catch (error) {
      console.error('Error analyzing frame:', error);
    }
  }

  async stopStreaming(): Promise<string> {
    this.recording = false;
    
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

    if (this.cameraRef) {
      await this.cameraRef.stopRecording();
    }

    // Send end of stream notification
    wsService.emit('stream_ended', {
      streamId: this.streamId,
      timestamp: new Date().toISOString(),
    });

    return this.streamId!;
  }

  private async uploadCompleteVideo(videoUri: string) {
    try {
      const videoBase64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload complete video as backup
      wsService.emit('video_complete', {
        streamId: this.streamId,
        video: videoBase64,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error uploading complete video:', error);
    }
  }

  private handleStreamError(error: any) {
    wsService.emit('stream_error', {
      streamId: this.streamId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  onAnalysis(callback: (analysis: AIAnalysis) => void) {
    this.onAnalysisCallback = callback;
    
    // Listen for AI analysis results from WebSocket
    wsService.on('ai_analysis', (data) => {
      if (data.streamId === this.streamId) {
        callback(data.analysis);
      }
    });
  }

  getBufferedChunks(): VideoChunk[] {
    return [...this.bufferedChunks];
  }

  isStreaming(): boolean {
    return this.recording;
  }
}

export const videoStreamService = new VideoStreamService();