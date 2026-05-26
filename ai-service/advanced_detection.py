"""
Advanced AI Detection Module for SafeCityPlus
Enhances base YOLO detection with temporal analysis, behavior detection,
anomaly detection, and ensemble methods for superior accuracy.
"""

import cv2
import numpy as np
from collections import deque, defaultdict
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class DetectionConfig:
    """Configuration for advanced detection parameters"""
    # Temporal analysis
    temporal_window: int = 5  # Number of frames to analyze
    min_detection_frames: int = 3  # Min frames for valid detection
    max_track_age: int = 10  # Max frames to keep tracking lost objects
    
    # Confidence boosting
    base_confidence_threshold: float = 0.3
    high_confidence_boost: float = 0.15
    temporal_consistency_bonus: float = 0.1
    
    # Behavior analysis
    velocity_threshold: float = 50  # Pixels per frame for "fast" movement
    crowd_threshold: int = 5  # Min people for crowd detection
    panic_velocity_threshold: float = 100  # Fast movement = panic
    
    # Anomaly detection
    anomaly_history_size: int = 100  # Frames for baseline
    anomaly_threshold: float = 2.5  # Standard deviations
    
    # Scene context
    roi_enabled: bool = True  # Region of Interest analysis
    intersection_zones: List[Tuple[int, int, int, int]] = field(default_factory=list)

# ============================================================================
# OBJECT TRACKING
# ============================================================================

@dataclass
class TrackedObject:
    """Tracks a single object across multiple frames"""
    id: int
    label: str
    bbox: Tuple[int, int, int, int]  # x, y, w, h
    confidence: float
    frames_tracked: int = 1
    last_seen: int = 0
    velocity: Tuple[float, float] = (0.0, 0.0)
    trajectory: deque = field(default_factory=lambda: deque(maxlen=10))
    confidence_history: deque = field(default_factory=lambda: deque(maxlen=5))
    
    def update(self, bbox: Tuple[int, int, int, int], confidence: float, frame_num: int):
        """Update tracked object with new detection"""
        # Calculate velocity
        dx = bbox[0] - self.bbox[0]
        dy = bbox[1] - self.bbox[1]
        self.velocity = (dx, dy)
        
        # Update trajectory
        center_x = bbox[0] + bbox[2] // 2
        center_y = bbox[1] + bbox[3] // 2
        self.trajectory.append((center_x, center_y))
        
        # Update confidence history
        self.confidence_history.append(confidence)
        
        self.bbox = bbox
        self.confidence = confidence
        self.frames_tracked += 1
        self.last_seen = frame_num
    
    def get_smoothed_confidence(self) -> float:
        """Get temporally smoothed confidence score"""
        if len(self.confidence_history) == 0:
            return self.confidence
        return np.mean(self.confidence_history)
    
    def get_speed(self) -> float:
        """Calculate object speed in pixels per frame"""
        return np.sqrt(self.velocity[0]**2 + self.velocity[1]**2)
    
    def is_moving_fast(self, threshold: float = 50) -> bool:
        """Check if object is moving fast"""
        return self.get_speed() > threshold


class ObjectTracker:
    """Multi-object tracking with temporal consistency"""
    
    def __init__(self, max_age: int = 10):
        self.tracks: Dict[int, TrackedObject] = {}
        self.next_id = 0
        self.max_age = max_age
        self.frame_count = 0
        
    def calculate_iou(self, bbox1: Tuple, bbox2: Tuple) -> float:
        """Calculate Intersection over Union for bounding boxes"""
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        
        xi1 = max(x1, x2)
        yi1 = max(y1, y2)
        xi2 = min(x1 + w1, x2 + w2)
        yi2 = min(y1 + h1, y2 + h2)
        
        inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        box1_area = w1 * h1
        box2_area = w2 * h2
        
        return inter_area / (box1_area + box2_area - inter_area + 1e-6)
    
    def update(self, detections: List[Dict], frame_num: int) -> List[TrackedObject]:
        """Update tracks with new detections using Hungarian algorithm concept"""
        self.frame_count = frame_num
        
        # Mark all existing tracks as not updated
        updated_tracks = set()
        
        # Match detections to existing tracks
        for det in detections:
            bbox = det.get('bbox', (0, 0, 0, 0))
            best_match = None
            best_iou = 0.3  # Minimum IOU threshold
            
            for track_id, track in self.tracks.items():
                if track_id in updated_tracks:
                    continue
                    
                iou = self.calculate_iou(bbox, track.bbox)
                if iou > best_iou and track.label == det.get('label'):
                    best_iou = iou
                    best_match = track_id
            
            if best_match is not None:
                # Update existing track
                self.tracks[best_match].update(bbox, det.get('confidence', 0), frame_num)
                updated_tracks.add(best_match)
            else:
                # Create new track
                new_track = TrackedObject(
                    id=self.next_id,
                    label=det.get('label', 'unknown'),
                    bbox=bbox,
                    confidence=det.get('confidence', 0),
                    last_seen=frame_num
                )
                center_x = bbox[0] + bbox[2] // 2
                center_y = bbox[1] + bbox[3] // 2
                new_track.trajectory.append((center_x, center_y))
                new_track.confidence_history.append(det.get('confidence', 0))
                
                self.tracks[self.next_id] = new_track
                updated_tracks.add(self.next_id)
                self.next_id += 1
        
        # Remove old tracks
        to_remove = []
        for track_id, track in self.tracks.items():
            if frame_num - track.last_seen > self.max_age:
                to_remove.append(track_id)
        
        for track_id in to_remove:
            del self.tracks[track_id]
        
        return list(self.tracks.values())

# ============================================================================
# BEHAVIOR ANALYSIS
# ============================================================================

class BehaviorAnalyzer:
    """Analyzes object behaviors for emergency patterns"""
    
    def __init__(self, config: DetectionConfig):
        self.config = config
        self.frame_history = deque(maxlen=config.temporal_window)
        
    def detect_crowd_panic(self, tracks: List[TrackedObject]) -> Optional[Dict]:
        """Detect crowd panic based on velocity patterns"""
        persons = [t for t in tracks if t.label == 'person']
        
        if len(persons) < self.config.crowd_threshold:
            return None
        
        # Calculate average velocity and direction variance
        velocities = [t.get_speed() for t in persons]
        avg_velocity = np.mean(velocities)
        fast_movers = sum(1 for v in velocities if v > self.config.panic_velocity_threshold)
        
        # Check for high velocity variance (chaotic movement)
        if len(velocities) > 1:
            velocity_variance = np.var(velocities)
        else:
            velocity_variance = 0
        
        # Panic detection criteria
        if fast_movers >= len(persons) * 0.6 and avg_velocity > self.config.panic_velocity_threshold:
            return {
                'type': 'Crowd Panic Detected',
                'severity': 'Critical',
                'priority': 'Critical',
                'confidence': min(0.95, 0.7 + (fast_movers / len(persons)) * 0.25),
                'details': {
                    'crowd_size': len(persons),
                    'fast_movers': fast_movers,
                    'avg_velocity': round(avg_velocity, 2)
                }
            }
        
        return None
    
    def detect_fighting(self, tracks: List[TrackedObject]) -> Optional[Dict]:
        """Detect potential violence/fighting between persons"""
        persons = [t for t in tracks if t.label == 'person']
        
        if len(persons) < 2:
            return None
        
        # Check for close proximity + fast movement
        fighting_pairs = 0
        for i, p1 in enumerate(persons):
            for p2 in persons[i+1:]:
                # Calculate distance
                c1 = p1.bbox[0] + p1.bbox[2]//2, p1.bbox[1] + p1.bbox[3]//2
                c2 = p2.bbox[0] + p2.bbox[2]//2, p2.bbox[1] + p2.bbox[3]//2
                distance = np.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2)
                
                # Close proximity check (within arm's reach ~100 pixels)
                if distance < 100:
                    # Check if both are moving fast
                    if p1.get_speed() > 30 and p2.get_speed() > 30:
                        fighting_pairs += 1
        
        if fighting_pairs > 0:
            return {
                'type': 'Potential Violence/Fighting',
                'severity': 'High',
                'priority': 'Critical',
                'confidence': min(0.9, 0.6 + fighting_pairs * 0.15),
                'details': {
                    'fighting_pairs': fighting_pairs,
                    'persons_involved': len(persons)
                }
            }
        
        return None
    
    def detect_loitering(self, tracks: List[TrackedObject]) -> List[Dict]:
        """Detect suspicious loitering behavior"""
        alerts = []
        
        for track in tracks:
            if track.label == 'person' and track.frames_tracked > 30:
                # Check if person has stayed in same area
                if len(track.trajectory) > 10:
                    positions = list(track.trajectory)
                    x_variance = np.var([p[0] for p in positions])
                    y_variance = np.var([p[1] for p in positions])
                    
                    # Low variance = not moving much
                    if x_variance < 100 and y_variance < 100:
                        alerts.append({
                            'type': 'Suspicious Loitering',
                            'severity': 'Medium',
                            'priority': 'Medium',
                            'confidence': 0.6,
                            'details': {
                                'track_id': track.id,
                                'duration_frames': track.frames_tracked
                            }
                        })
        
        return alerts

# ============================================================================
# ANOMALY DETECTION
# ============================================================================

class AnomalyDetector:
    """Detects anomalous patterns using statistical baseline"""
    
    def __init__(self, config: DetectionConfig):
        self.config = config
        self.baseline_stats = defaultdict(lambda: {
            'counts': deque(maxlen=config.anomaly_history_size),
            'mean': 0,
            'std': 0
        })
        self.is_calibrated = False
        
    def update_baseline(self, scene_type: str, object_counts: Dict[str, int]):
        """Update baseline statistics for scene type"""
        for obj_type, count in object_counts.items():
            key = f"{scene_type}_{obj_type}"
            self.baseline_stats[key]['counts'].append(count)
            
            # Recalculate statistics
            counts = list(self.baseline_stats[key]['counts'])
            if len(counts) > 10:
                self.baseline_stats[key]['mean'] = np.mean(counts)
                self.baseline_stats[key]['std'] = np.std(counts) + 1e-6
        
        if len(list(self.baseline_stats.values())[0]['counts']) >= 30:
            self.is_calibrated = True
    
    def detect_anomalies(self, scene_type: str, object_counts: Dict[str, int]) -> List[Dict]:
        """Detect anomalies based on statistical deviation"""
        if not self.is_calibrated:
            return []
        
        anomalies = []
        for obj_type, count in object_counts.items():
            key = f"{scene_type}_{obj_type}"
            stats = self.baseline_stats[key]
            
            if stats['std'] > 0:
                z_score = (count - stats['mean']) / stats['std']
                
                if abs(z_score) > self.config.anomaly_threshold:
                    anomaly_type = 'Unusually High' if z_score > 0 else 'Unusually Low'
                    severity = 'High' if abs(z_score) > 4 else 'Medium'
                    
                    anomalies.append({
                        'type': f'{anomaly_type} {obj_type} Count',
                        'severity': severity,
                        'priority': 'High' if severity == 'High' else 'Medium',
                        'confidence': min(0.95, 0.7 + abs(z_score) * 0.05),
                        'details': {
                            'object_type': obj_type,
                            'current_count': count,
                            'expected_range': f"{stats['mean']-stats['std']:.1f} - {stats['mean']+stats['std']:.1f}",
                            'z_score': round(z_score, 2)
                        }
                    })
        
        return anomalies

# ============================================================================
# SCENE CONTEXT ANALYZER
# ============================================================================

class SceneContextAnalyzer:
    """Analyzes scene context for better emergency classification"""
    
    def __init__(self):
        self.scene_types = ['intersection', 'highway', 'construction', 'residential', 'commercial']
        
    def detect_scene_type(self, tracks: List[TrackedObject]) -> str:
        """Detect scene type based on object distribution"""
        labels = [t.label for t in tracks]
        
        # Count relevant objects
        cars = labels.count('car') + labels.count('truck') + labels.count('bus')
        traffic_lights = labels.count('traffic light')
        construction_gear = labels.count('helmet') + labels.count('hard hat')
        
        if traffic_lights > 0 and cars > 3:
            return 'intersection'
        elif cars > 5:
            return 'highway'
        elif construction_gear > 2:
            return 'construction'
        elif cars < 2 and labels.count('person') > 3:
            return 'residential'
        else:
            return 'commercial'
    
    def get_context_boost(self, scene_type: str, incident_type: str) -> float:
        """Get confidence boost based on scene-incident compatibility"""
        boost_matrix = {
            'intersection': {
                'Vehicle-to-Vehicle Collision': 0.15,
                'Heavy Truck Accident': 0.1,
                'Bus Accident': 0.1,
                'Road Blockage': 0.1
            },
            'highway': {
                'Heavy Truck Accident': 0.2,
                'Vehicle-to-Vehicle Collision': 0.15,
                'Bus Accident': 0.1
            },
            'construction': {
                'Construction Equipment Malfunction': 0.2,
                'Heavy Truck Accident': 0.1,
                'Worker Safety Concern': 0.15
            }
        }
        
        return boost_matrix.get(scene_type, {}).get(incident_type, 0.0)

# ============================================================================
# ENSEMBLE DETECTOR
# ============================================================================

class EnsembleDetector:
    """Combines multiple detection signals for robust results"""
    
    def __init__(self, config: DetectionConfig = None):
        self.config = config or DetectionConfig()
        self.tracker = ObjectTracker(max_age=config.max_track_age if config else 10)
        self.behavior_analyzer = BehaviorAnalyzer(self.config)
        self.anomaly_detector = AnomalyDetector(self.config)
        self.scene_analyzer = SceneContextAnalyzer()
        self.frame_count = 0
        
    def process_frame(self, detections: List[Dict], img_shape: Tuple = None) -> Dict:
        """
        Process a single frame with all advanced detection methods
        
        Args:
            detections: List of detection dicts from base YOLO model
            img_shape: (width, height) of the image
            
        Returns:
            Enhanced detection result with confidence boosting
        """
        self.frame_count += 1
        
        # 1. Temporal tracking
        tracked_objects = self.tracker.update(detections, self.frame_count)
        
        # 2. Scene context analysis
        scene_type = self.scene_analyzer.detect_scene_type(tracked_objects)
        
        # 3. Behavior analysis
        behavior_alerts = []
        
        # Check for crowd panic
        panic = self.behavior_analyzer.detect_crowd_panic(tracked_objects)
        if panic:
            behavior_alerts.append(panic)
        
        # Check for fighting
        fighting = self.behavior_analyzer.detect_fighting(tracked_objects)
        if fighting:
            behavior_alerts.append(fighting)
        
        # Check for loitering
        loitering = self.behavior_analyzer.detect_loitering(tracked_objects)
        behavior_alerts.extend(loitering)
        
        # 4. Anomaly detection
        object_counts = defaultdict(int)
        for obj in tracked_objects:
            object_counts[obj.label] += 1
        
        self.anomaly_detector.update_baseline(scene_type, dict(object_counts))
        anomalies = self.anomaly_detector.detect_anomalies(scene_type, dict(object_counts))
        
        # 5. Ensemble confidence boosting
        enhanced_detections = []
        for track in tracked_objects:
            base_conf = track.get_smoothed_confidence()
            
            # Temporal consistency bonus
            if track.frames_tracked >= self.config.min_detection_frames:
                base_conf += self.config.temporal_consistency_bonus
            
            # Movement-based boost (fast moving objects in emergencies)
            if track.is_moving_fast(self.config.velocity_threshold):
                if track.label in ['car', 'truck', 'bus', 'motorcycle', 'person']:
                    base_conf += 0.05
            
            # Scene context boost
            # Note: Need to map track label to incident type for boost
            
            # Cap confidence at 0.98
            final_conf = min(0.98, base_conf)
            
            enhanced_detections.append({
                'id': track.id,
                'label': track.label,
                'confidence': round(final_conf, 3),
                'base_confidence': round(track.confidence, 3),
                'frames_tracked': track.frames_tracked,
                'velocity': round(track.get_speed(), 2),
                'is_fast': track.is_moving_fast(self.config.velocity_threshold),
                'bbox': track.bbox
            })
        
        # Sort by confidence
        enhanced_detections.sort(key=lambda x: x['confidence'], reverse=True)
        
        # Compile final result
        result = {
            'scene_type': scene_type,
            'frame_number': self.frame_count,
            'total_tracked_objects': len(tracked_objects),
            'object_counts': dict(object_counts),
            'enhanced_detections': enhanced_detections,
            'behavior_alerts': behavior_alerts,
            'anomalies': anomalies,
            'is_calibrated': self.anomaly_detector.is_calibrated,
            'processing_metadata': {
                'temporal_window': self.config.temporal_window,
                'min_detection_frames': self.config.min_detection_frames
            }
        }
        
        return result

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def draw_tracks_on_frame(frame: np.ndarray, tracks: List[TrackedObject], 
                         draw_trajectory: bool = True) -> np.ndarray:
    """Visualize tracking information on frame"""
    result = frame.copy()
    
    for track in tracks:
        x, y, w, h = track.bbox
        
        # Color based on speed
        if track.is_moving_fast(100):
            color = (0, 0, 255)  # Red for fast
        elif track.is_moving_fast(50):
            color = (0, 165, 255)  # Orange for medium
        else:
            color = (0, 255, 0)  # Green for slow
        
        # Draw bounding box
        cv2.rectangle(result, (x, y), (x+w, y+h), color, 2)
        
        # Draw ID and confidence
        label_text = f"ID:{track.id} {track.label} {track.get_smoothed_confidence():.2f}"
        cv2.putText(result, label_text, (x, y-10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Draw trajectory
        if draw_trajectory and len(track.trajectory) > 1:
            points = list(track.trajectory)
            for i in range(1, len(points)):
                pt1 = tuple(map(int, points[i-1]))
                pt2 = tuple(map(int, points[i]))
                cv2.line(result, pt1, pt2, color, 2)
    
    return result


def create_detection_summary(ensemble_result: Dict) -> str:
    """Create a human-readable summary of detection results"""
    lines = [
        f"=== Frame {ensemble_result['frame_number']} Analysis ===",
        f"Scene Type: {ensemble_result['scene_type']}",
        f"Total Objects: {ensemble_result['total_tracked_objects']}",
        ""
    ]
    
    if ensemble_result['object_counts']:
        lines.append("Object Counts:")
        for obj_type, count in sorted(ensemble_result['object_counts'].items(), 
                                        key=lambda x: -x[1]):
            lines.append(f"  - {obj_type}: {count}")
        lines.append("")
    
    if ensemble_result['enhanced_detections']:
        lines.append("Top Detections:")
        for det in ensemble_result['enhanced_detections'][:5]:
            speed_info = f" [FAST]" if det['is_fast'] else ""
            lines.append(f"  - {det['label']} (ID:{det['id']}): "
                        f"{det['confidence']:.2f} confidence{speed_info}")
        lines.append("")
    
    if ensemble_result['behavior_alerts']:
        lines.append("⚠️ BEHAVIOR ALERTS:")
        for alert in ensemble_result['behavior_alerts']:
            lines.append(f"  - {alert['type']} ({alert['severity']})")
        lines.append("")
    
    if ensemble_result['anomalies']:
        lines.append("📊 ANOMALIES DETECTED:")
        for anom in ensemble_result['anomalies']:
            lines.append(f"  - {anom['type']} (z={anom['details']['z_score']})")
    
    return "\n".join(lines)


# Export main classes
__all__ = [
    'DetectionConfig',
    'ObjectTracker', 
    'TrackedObject',
    'BehaviorAnalyzer',
    'AnomalyDetector',
    'SceneContextAnalyzer',
    'EnsembleDetector',
    'draw_tracks_on_frame',
    'create_detection_summary'
]
