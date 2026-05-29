from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import io
import logging
import time
import os
import tempfile
import base64
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict, deque
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

# Numerical operations for advanced detection
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    print("⚠️  NumPy not installed. Some advanced features disabled.")

# Try to import PIL
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️  PIL not installed. Run: pip install pillow")

# Try to import ultralytics (YOLO)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
    print("✅ YOLO available")
except ImportError:
    YOLO_AVAILABLE = False
    print("⚠️  YOLO/Ultralytics not available. Will use basic analysis.")

# Try to import video processing libraries
try:
    import cv2
    CV2_AVAILABLE = True
    print("✅ OpenCV available")
except ImportError:
    CV2_AVAILABLE = False
    print("⚠️  OpenCV not available. Video analysis disabled.")

try:
    import psutil
    PSUTIL_AVAILABLE = True
    print("✅ psutil available")
except ImportError:
    PSUTIL_AVAILABLE = False
    print("⚠️  psutil not available. Metrics disabled.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import confusion matrix tracker
from confusion_matrix import (
    ConfusionMatrixTracker, 
    SimpleConfusionTracker,
    DetectionPrediction,
    GroundTruthLabel,
    object_detection_tracker,
    alert_classification_tracker,
    get_performance_report
)

# Initialize FastAPI app
app = FastAPI(
    title="SafeCity+ AI Service",
    description="AI-powered incident detection with multi-object analysis and video support",
    version="3.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Performance tracking
performance_metrics = {
    'requests': [],
    'processing_times': [],
    'errors': []
}
start_time = time.time()

# Thread pool for parallel processing
executor = ThreadPoolExecutor(max_workers=4)

# ============================================================================
# PERFORMANCE OPTIMIZATION CONFIGURATION
# ============================================================================
@dataclass
class PerformanceConfig:
    """Performance tuning settings"""
    # Image preprocessing
    max_image_size: Tuple[int, int] = (640, 480)  # Resize large images
    min_image_size: Tuple[int, int] = (320, 240)  # Minimum for small images
    
    # Detection confidence thresholds
    yolo_conf_threshold: float = 0.30  # YOLO confidence threshold
    fire_conf_threshold: float = 0.60   # Fire detection threshold
    
    # Frame sampling for video streams
    frame_sample_rate: int = 3  # Process every Nth frame (1 = every frame)
    min_frame_interval_ms: float = 500.0  # Minimum ms between analyses
    
    # Caching
    cache_enabled: bool = True
    cache_ttl_seconds: float = 2.0  # Cache results for 2 seconds
    
    # Async processing
    use_async: bool = True
    max_concurrent_requests: int = 10

perf_config = PerformanceConfig()

# Simple LRU cache for detection results
class DetectionCache:
    """Simple time-based cache for detection results"""
    def __init__(self, ttl_seconds: float = 2.0):
        self.cache = {}
        self.ttl = ttl_seconds
        self.hits = 0
        self.misses = 0
    
    def _get_key(self, img) -> str:
        """Generate cache key from image"""
        if not NUMPY_AVAILABLE or not PIL_AVAILABLE:
            return None
        try:
            # Use small thumbnail hash as key
            thumb = img.resize((32, 32))
            arr = np.array(thumb)
            return hash(arr.tobytes())
        except:
            return None
    
    def get(self, img) -> Optional[List[Dict]]:
        """Get cached result if not expired"""
        if not perf_config.cache_enabled:
            return None
        key = self._get_key(img)
        if key is None:
            return None
        
        if key in self.cache:
            result, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl:
                self.hits += 1
                return result
            else:
                del self.cache[key]
        
        self.misses += 1
        return None
    
    def set(self, img, result: List[Dict]):
        """Cache detection result"""
        if not perf_config.cache_enabled:
            return
        key = self._get_key(img)
        if key is not None:
            self.cache[key] = (result, time.time())
            # Cleanup old entries
            now = time.time()
            expired = [k for k, (r, ts) in self.cache.items() if now - ts > self.ttl]
            for k in expired:
                del self.cache[k]
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate_percent': round(hit_rate, 1),
            'size': len(self.cache)
        }

# Initialize detection cache
detection_cache = DetectionCache(ttl_seconds=perf_config.cache_ttl_seconds)

# Frame throttling tracking
frame_last_analysis = defaultdict(float)

# Load YOLO if available
yolo_model = None
if YOLO_AVAILABLE:
    try:
        logger.info("Loading YOLOv8 model...")
        yolo_model = YOLO('yolov8n.pt')
        logger.info("✅ YOLOv8 model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load YOLO: {e}")
        YOLO_AVAILABLE = False

# ── Ethiopian-context Emergency Incident Classification ────────────────────────
# Categories: Road/Traffic, Fire/Explosion, Construction, Industrial,
#             Environmental/Public Safety, Crowd, Weapons, Medical
# Objects detected by out of these categories → "Out of Common Incidents"
EMERGENCY_MAPPING = {

    # ── ROAD & TRAFFIC ACCIDENTS ──────────────────────────────────────────────
    'car': {
        'type': 'Vehicle-to-Vehicle Collision',
        'category': 'Road & Traffic',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Traffic Police & Ambulance',
        'weight': 9
    },
    'truck': {
        'type': 'Heavy Truck Accident',
        'category': 'Road & Traffic',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Traffic Police, Fire Brigade & Ambulance',
        'weight': 9
    },
    'bus': {
        'type': 'Bus Accident / Possible Rollover',
        'category': 'Road & Traffic',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Multiple Ambulances & Traffic Police',
        'weight': 9
    },
    'motorcycle': {
        'type': 'Motorcycle / Bajaj Accident',
        'category': 'Road & Traffic',
        'severity': 'High',
        'priority': 'Critical',
        'response': 'Dispatch Ambulance & Traffic Police',
        'weight': 8
    },
    'bicycle': {
        'type': 'Bicycle Accident',
        'category': 'Road & Traffic',
        'severity': 'Medium',
        'priority': 'High',
        'response': 'Dispatch Ambulance',
        'weight': 6
    },

    # ── PEDESTRIAN DANGER ─────────────────────────────────────────────────────
    'person': {
        'type': 'Pedestrian / Person in Danger',
        'category': 'Road & Traffic',
        'severity': 'High',
        'priority': 'High',
        'response': 'Dispatch Ambulance & Traffic Control',
        'weight': 8
    },

    # ── FIRE & EXPLOSION ──────────────────────────────────────────────────────
    'fire': {
        'type': 'Fire Emergency Detected',
        'category': 'Fire & Explosion',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Fire Brigade & Ambulance immediately',
        'weight': 10
    },
    'flame': {
        'type': 'Open Flame Detected — Fire Risk',
        'category': 'Fire & Explosion',
        'severity': 'High',
        'priority': 'Critical',
        'response': 'Dispatch Fire Brigade — potential fire hazard',
        'weight': 9
    },
    'candle': {
        'type': 'Candle Fire — Unattended Flame',
        'category': 'Fire & Explosion',
        'severity': 'High',
        'priority': 'High',
        'response': 'Alert security — unattended open flame detected',
        'weight': 7
    },
    'lighter': {
        'type': 'Lighter/Ignition Source Detected',
        'category': 'Fire & Explosion',
        'severity': 'Medium',
        'priority': 'Medium',
        'response': 'Monitor — potential arson/fire risk',
        'weight': 5
    },
    'torch': {
        'type': 'Torch/Flame Device Detected',
        'category': 'Fire & Explosion',
        'severity': 'High',
        'priority': 'High',
        'response': 'Investigate — open flame in public area',
        'weight': 7
    },
    'smoke': {
        'type': 'Smoke Detected — Possible Fire',
        'category': 'Fire & Explosion',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Fire Brigade & investigate source',
        'weight': 9
    },

    # ── MEDICAL EMERGENCY ─────────────────────────────────────────────────────
    'blood': {
        'type': 'Medical Emergency — Injury/Blood Detected',
        'category': 'Medical',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Ambulance immediately',
        'weight': 10
    },

    # ── CONSTRUCTION SITE ACCIDENTS ───────────────────────────────────────────
    'crane': {
        'type': 'Crane / Heavy Equipment Accident',
        'category': 'Construction',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Emergency Response & stop site operations',
        'weight': 9
    },
    'hard hat': {
        'type': 'Construction Worker — Safety Concern',
        'category': 'Construction',
        'severity': 'Medium',
        'priority': 'Medium',
        'response': 'Alert site supervisor',
        'weight': 4
    },
    'helmet': {
        'type': 'Worker with Safety Helmet Detected',
        'category': 'Construction',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Monitor',
        'weight': 2
    },

    # ── CROWD / STAMPEDE ──────────────────────────────────────────────────────
    'crowd': {
        'type': 'Large Crowd Gathering — Stampede Risk',
        'category': 'Crowd & Public Safety',
        'severity': 'High',
        'priority': 'High',
        'response': 'Deploy crowd control officers',
        'weight': 7
    },

    # ── EMERGENCY VEHICLES (indicates active emergency) ───────────────────────
    'ambulance': {
        'type': 'Ambulance Present — Active Emergency',
        'category': 'Medical',
        'severity': 'High',
        'priority': 'High',
        'response': 'Clear path for emergency vehicle',
        'weight': 8
    },

    # ── WEAPONS ───────────────────────────────────────────────────────────────
    'knife': {
        'type': 'Weapon Detected — Knife',
        'category': 'Security',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Police immediately',
        'weight': 10
    },
    'gun': {
        'type': 'Weapon Detected — Firearm',
        'category': 'Security',
        'severity': 'Critical',
        'priority': 'Critical',
        'response': 'Dispatch Armed Police immediately',
        'weight': 10
    },
    'scissors': {
        'type': 'Sharp Object — Potential Threat',
        'category': 'Security',
        'severity': 'High',
        'priority': 'High',
        'response': 'Monitor and alert security',
        'weight': 6
    },

    # ── SUSPICIOUS / ABANDONED OBJECTS ────────────────────────────────────────
    'backpack': {
        'type': 'Unattended Baggage — Suspicious',
        'category': 'Security',
        'severity': 'Medium',
        'priority': 'Medium',
        'response': 'Investigate abandoned object',
        'weight': 5
    },
    'suitcase': {
        'type': 'Unattended Luggage — Suspicious',
        'category': 'Security',
        'severity': 'Medium',
        'priority': 'Medium',
        'response': 'Investigate abandoned object',
        'weight': 5
    },

    # ── GENERAL ROAD OBJECTS (road blockage) ─────────────────────────────────
    'stop sign': {
        'type': 'Road Sign — Traffic Management',
        'category': 'Road & Traffic',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Monitor',
        'weight': 2
    },
    'traffic light': {
        'type': 'Traffic Signal Area',
        'category': 'Road & Traffic',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Monitor',
        'weight': 2
    },

    # ── LOW PRIORITY / CONTEXT OBJECTS ────────────────────────────────────────
    'bottle': {
        'type': 'Suspicious Object (Bottle)',
        'category': 'Security',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Monitor',
        'weight': 2
    },
    'cell phone': {
        'type': 'Suspicious Activity — Phone Use',
        'category': 'Security',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Monitor',
        'weight': 2
    },
    'chair': {
        'type': 'Object on Road — Possible Blockage',
        'category': 'Road & Traffic',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Remove obstruction',
        'weight': 2
    },
    'table': {
        'type': 'Object Obstruction Detected',
        'category': 'Road & Traffic',
        'severity': 'Low',
        'priority': 'Low',
        'response': 'Remove obstruction',
        'weight': 2
    },
}

def extract_frame_from_video(video_bytes: bytes) -> Image.Image:
    """Extract first frame from video using OpenCV"""
    if not CV2_AVAILABLE:
        raise Exception("OpenCV not available")
    
    try:
        # Save video temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            tmp_file.write(video_bytes)
            tmp_path = tmp_file.name
        
        # Extract first frame using OpenCV
        cap = cv2.VideoCapture(tmp_path)
        ret, frame = cap.read()
        cap.release()
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        if ret:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            return Image.fromarray(frame_rgb)
        else:
            raise Exception("Could not extract frame from video")
            
    except Exception as e:
        logger.error(f"Error extracting frame: {e}")
        raise

def classify_fire_size(bbox_area_ratio: float) -> Dict[str, Any]:
    """
    Classify fire size based on bounding box area relative to image.
    
    Args:
        bbox_area_ratio: Area of fire bbox / Total image area (0.0 to 1.0)
    
    Returns:
        Dict with fire size classification and adjusted severity
    """
    if bbox_area_ratio < 0.01:  # Less than 1% of image
        return {
            'size_class': 'Small',
            'size_description': 'Small fire — Candle/Minor flame',
            'severity_adjustment': -1,  # Reduce severity
            'response_modifier': 'Minor incident — monitor closely'
        }
    elif bbox_area_ratio < 0.05:  # 1-5% of image
        return {
            'size_class': 'Medium',
            'size_description': 'Medium fire — Trash/Container fire',
            'severity_adjustment': 0,
            'response_modifier': 'Standard response'
        }
    elif bbox_area_ratio < 0.15:  # 5-15% of image
        return {
            'size_class': 'Large',
            'size_description': 'Large fire — Room/Vehicle fire',
            'severity_adjustment': 1,
            'response_modifier': 'Urgent — multiple units'
        }
    else:  # More than 15% of image
        return {
            'size_class': 'Major',
            'size_description': 'Major fire — Building/Structure fire',
            'severity_adjustment': 2,
            'response_modifier': 'EMERGENCY — full brigade dispatch'
        }


def is_fire_related(label: str) -> bool:
    """Check if detection label is fire-related"""
    fire_labels = {'fire', 'flame', 'candle', 'lighter', 'torch', 'smoke'}
    return label.lower() in fire_labels


def detect_fire_by_color(img, debug: bool = False) -> List[Dict[str, Any]]:
    """
    Detect fire using color analysis (HSV) as fallback when YOLO fails.
    Fire typically appears as bright orange/yellow/red in images.
    
    Args:
        img: PIL Image
        debug: If True, prints debug information
    
    Returns list of detected fire regions with confidence scores.
    """
    if not CV2_AVAILABLE or not PIL_AVAILABLE:
        logger.warning("OpenCV or PIL not available for color fire detection")
        return []
    
    try:
        # Convert PIL image to OpenCV format
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        img_hsv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2HSV)
        
        fire_detections = []
        
        # Define fire color ranges in HSV - IMPROVED for candle flames
        # Fire colors: bright orange (15-25), yellow (25-40), red (0-10, 170-180)
        # Lowered saturation and value thresholds to catch more flames
        fire_color_ranges = [
            # Lower red (0-10 hue) - lowered thresholds
            (np.array([0, 80, 150]), np.array([10, 255, 255])),
            # Upper red (170-180 hue) - lowered thresholds
            (np.array([170, 80, 150]), np.array([180, 255, 255])),
            # Orange (10-25 hue) - good for flames
            (np.array([10, 100, 150]), np.array([25, 255, 255])),
            # Yellow (25-40 hue) - widened range for bright candle flames
            (np.array([25, 80, 180]), np.array([40, 255, 255])),
            # Bright yellow-white core of flame (high value, any hue)
            (np.array([15, 30, 220]), np.array([45, 200, 255])),
            # Very bright white/yellow (candle core)
            (np.array([20, 20, 240]), np.array([50, 180, 255]))
        ]
        
        # Create combined mask
        combined_mask = np.zeros(img_hsv.shape[:2], dtype=np.uint8)
        
        for lower, upper in fire_color_ranges:
            mask = cv2.inRange(img_hsv, lower, upper)
            combined_mask = cv2.bitwise_or(combined_mask, mask)
        
        # Clean up mask
        kernel = np.ones((5, 5), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        img_h, img_w = img_cv.shape[:2]
        img_area = img_h * img_w
        
        if debug:
            logger.info(f"🔥 Color fire detection: Found {len(contours)} raw contours")
            # Debug: save mask for inspection
            debug_path = f"fire_mask_debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(debug_path, combined_mask)
            logger.info(f"🔥 Debug mask saved to: {debug_path}")
        
        valid_contours = 0
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Filter small noise (min area threshold) - LOWERED for small candle flames
            if area < 30:  # Skip very small regions (was 100, now 30)
                continue
            
            valid_contours += 1
            
            # Calculate bounding box
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate fire characteristics
            bbox_area_ratio = (w * h) / img_area
            
            # Calculate brightness in the region (fire is bright)
            roi = img_hsv[y:y+h, x:x+w]
            if roi.size > 0:
                avg_brightness = np.mean(roi[:, :, 2])  # Value channel
                brightness_score = min(1.0, avg_brightness / 255.0)
            else:
                brightness_score = 0.5
            
            # Calculate circularity (fire tends to be irregular/round)
            perimeter = cv2.arcLength(contour, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter ** 2)
            else:
                circularity = 0
            
            # Determine fire type based on size
            if bbox_area_ratio < 0.005:
                fire_type = "Small Flame/Candle Fire"
                confidence = min(0.85, 0.5 + brightness_score * 0.3 + bbox_area_ratio * 10)
            elif bbox_area_ratio < 0.02:
                fire_type = "Open Flame Detected"
                confidence = min(0.90, 0.6 + brightness_score * 0.3)
            else:
                fire_type = "Fire Emergency"
                confidence = min(0.95, 0.7 + brightness_score * 0.25)
            
            # Boost confidence for high brightness (strong fire indicator)
            if brightness_score > 0.9:
                confidence = min(0.98, confidence + 0.1)
            
            # Create display-friendly label
            if bbox_area_ratio < 0.005:
                display_label = "candle"
            elif bbox_area_ratio < 0.02:
                display_label = "flame"
            else:
                display_label = "fire"
            
            fire_detections.append({
                "type": fire_type,
                "category": "Fire & Explosion",
                "severity": "High" if bbox_area_ratio < 0.01 else "Critical",
                "priority": "High" if bbox_area_ratio < 0.01 else "Critical",
                "confidence": round(confidence, 2),
                "response": "Alert security — unattended flame detected" if bbox_area_ratio < 0.01 else "Dispatch Fire Brigade immediately",
                "weight": 7 if bbox_area_ratio < 0.01 else 10,
                "label": display_label,  # Display-friendly label for dashboard
                "raw_label": "fire_color_detected",
                "detection_method": "color_analysis",
                "fire_size": classify_fire_size(bbox_area_ratio),
                "bbox": {
                    "x": round(x / img_w, 4),
                    "y": round(y / img_h, 4),
                    "w": round(w / img_w, 4),
                    "h": round(h / img_h, 4)
                },
                "brightness_score": round(brightness_score, 2),
                "circularity": round(circularity, 2),
                "pixel_area": int(area)
            })
        
        # Sort by confidence
        fire_detections.sort(key=lambda x: x['confidence'], reverse=True)
        
        if debug or fire_detections:
            logger.info(f"🔥 Color fire detection: Found {len(fire_detections)} valid fire region(s) from {valid_contours} contours")
        
        return fire_detections
        
    except Exception as e:
        logger.error(f"Color-based fire detection error: {e}")
        return []


def map_detection_to_incident(label: str, confidence: float, 
                              bbox_area_ratio: float = 0.0) -> Dict[str, Any]:
    """Map a single detection to Ethiopian-context incident type.
    Objects not in the known classification → 'Out of Common Incidents'.
    Includes fire size classification for fire-related detections."""

    label_lower = label.lower()

    if label_lower in EMERGENCY_MAPPING:
        mapping = EMERGENCY_MAPPING[label_lower]
        incident_type = mapping['type']
        category      = mapping.get('category', 'General')
        severity      = mapping['severity']
        priority      = mapping['priority']
        response      = mapping.get('response', 'Monitor situation')
        weight        = mapping['weight']
    else:
        # Object is not in the Ethiopian common-accident classification list
        incident_type = f"Out of Common Incidents ({label.capitalize()})"
        category      = 'Unknown'
        response      = 'Monitor — not a classified Ethiopian emergency type'
        if confidence > 0.85:
            weight = 3
            severity, priority = "Low", "Low"
        elif confidence > 0.6:
            weight = 2
            severity, priority = "Low", "Low"
        else:
            weight = 1
            severity, priority = "Low", "Low"

    # Boost weight for high-confidence known detections
    if label_lower in EMERGENCY_MAPPING:
        if confidence > 0.9:
            weight += 2
        elif confidence > 0.75:
            weight += 1
    
    # Fire size classification for fire-related incidents
    fire_size_info = None
    if is_fire_related(label) and bbox_area_ratio > 0:
        fire_size_info = classify_fire_size(bbox_area_ratio)
        
        # Adjust severity and response based on fire size
        if fire_size_info['size_class'] == 'Small':
            # Small fire (candle) - reduce severity but still alert
            if severity == 'Critical':
                severity = 'High'
            incident_type = f"Small Fire Detected — {fire_size_info['size_description']}"
            response = fire_size_info['response_modifier']
            weight = max(5, weight - 2)  # Reduce weight but keep significant
            
        elif fire_size_info['size_class'] == 'Major':
            # Major fire - escalate
            severity = 'Critical'
            priority = 'Critical'
            incident_type = f"MAJOR FIRE — {fire_size_info['size_description']}"
            response = fire_size_info['response_modifier']
            weight = min(12, weight + 2)  # Increase weight, cap at 12
    
    result = {
        "type":       incident_type,
        "category":   category,
        "confidence": round(confidence, 2),
        "severity":   severity,
        "priority":   priority,
        "response":   response,
        "weight":     weight,
        "raw_label":  label
    }
    
    # Add fire size info if applicable
    if fire_size_info:
        result["fire_size"] = fire_size_info
    
    return result

def analyze_all_objects(img) -> List[Dict[str, Any]]:
    """Detect all objects in the image and return list of incidents"""
    detections = []
    
    try:
        results = yolo_model(img)
        
        # Get image dimensions for fire size calculation
        img_w, img_h = img.size if PIL_AVAILABLE else (640, 480)
        img_area = img_w * img_h
        
        for r in results:
            if len(r.boxes) > 0:
                for box in r.boxes:
                    label = yolo_model.names[int(box.cls[0])]
                    confidence = float(box.conf[0])
                    
                    # Calculate bounding box area ratio for fire size classification
                    bbox_area_ratio = 0.0
                    if is_fire_related(label):
                        xyxy = box.xyxy[0].tolist()
                        x1, y1, x2, y2 = xyxy
                        bbox_area = (x2 - x1) * (y2 - y1)
                        bbox_area_ratio = bbox_area / img_area if img_area > 0 else 0.0
                    
                    # Only include detections with confidence > 0.3
                    if confidence > 0.3:
                        incident = map_detection_to_incident(label, confidence, bbox_area_ratio)
                        detections.append(incident)
                        logger.debug(f"  - {label}: {confidence:.2f} -> {incident['type']}")
        
        # Sort by weight (most severe first)
        detections.sort(key=lambda x: x['weight'], reverse=True)
        
    except Exception as e:
        logger.error(f"Error in object detection: {e}")
    
    return detections

def get_most_severe_incident(detections: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get the most severe incident from all detections"""
    
    if not detections:
        return {
            "type": "No Clear Emergency Detected",
            "confidence": 0,
            "severity": "Low",
            "priority": "Normal",
            "detections": []
        }
    
    # Get the highest weight detection
    most_severe = detections[0]
    
    # Calculate overall severity based on all detections
    max_weight = most_severe['weight']
    
    # If there are multiple high-weight detections, escalate severity
    high_weight_count = sum(1 for d in detections if d['weight'] >= 7)
    
    if high_weight_count >= 2:
        # Multiple severe incidents - escalate to Critical
        most_severe['severity'] = 'Critical'
        most_severe['priority'] = 'Critical'
        most_severe['type'] = f"Multiple Incidents: {most_severe['type']} + {high_weight_count-1} more"
    
    return {
        **most_severe,
        "detections": detections,
        "total_objects_detected": len(detections)
    }

def analyze_video_frames(video_path: str, frame_interval: int = 2) -> List[Dict[str, Any]]:
    """Extract and analyze frames from video"""
    detections = []
    
    if not CV2_AVAILABLE:
        return detections
    
    try:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_skip = int(fps * frame_interval)
        frame_count = 0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Analyzing video: {total_frames} frames, {fps} fps")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % frame_skip == 0:
                # Convert frame to PIL Image
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(frame_rgb)
                
                # Analyze frame
                frame_detections = analyze_all_objects(pil_img)
                if frame_detections:
                    detections.append({
                        "timestamp": round(frame_count / fps, 2),
                        "frame_number": frame_count,
                        "detections": frame_detections
                    })
            
            frame_count += 1
        
        cap.release()
        
    except Exception as e:
        logger.error(f"Video analysis error: {e}")
    
    return detections

def simple_multi_analysis(image_data: bytes) -> Dict[str, Any]:
    """Fallback: Basic multi-object analysis without YOLO"""
    try:
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        width, height = img.size
        
        # Convert to grayscale and get stats
        gray = img.convert('L')
        pixels = list(gray.getdata())
        avg_brightness = sum(pixels) / len(pixels)
        std_brightness = (sum((x - avg_brightness) ** 2 for x in pixels) / len(pixels)) ** 0.5
        
        detections = []
        
        # Simple brightness-based "detections"
        if avg_brightness < 60:
            detections.append({
                "type": "Dark Area Detected",
                "confidence": 0.55,
                "severity": "Low",
                "priority": "Low",
                "weight": 2,
                "raw_label": "dark_region"
            })
        
        if std_brightness > 80:
            detections.append({
                "type": "High Contrast Scene (Possible Disturbance)",
                "confidence": 0.6,
                "severity": "Medium",
                "priority": "Medium",
                "weight": 4,
                "raw_label": "high_contrast"
            })
        
        if width > 2000 or height > 2000:
            detections.append({
                "type": "Large Scale Scene",
                "confidence": 0.4,
                "severity": "Low",
                "priority": "Low",
                "weight": 1,
                "raw_label": "large_scale"
            })
        
        if not detections:
            detections.append({
                "type": "Normal Scene",
                "confidence": 0.2,
                "severity": "Low",
                "priority": "Normal",
                "weight": 0,
                "raw_label": "normal"
            })
        
        detections.sort(key=lambda x: x['weight'], reverse=True)
        
        return {
            **detections[0],
            "detections": detections,
            "total_objects_detected": len(detections)
        }
        
    except Exception as e:
        logger.error(f"Simple analysis failed: {e}")
        return {
            "type": "Unknown Incident",
            "confidence": 0,
            "severity": "Low",
            "priority": "Normal",
            "detections": [],
            "total_objects_detected": 0
        }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "SafeCity+ AI Service",
        "status": "online",
        "version": "3.0.0",
        "features": {
            "multi_object_detection": YOLO_AVAILABLE,
            "video_analysis": CV2_AVAILABLE,
            "severity_ranking": True,
            "batch_processing": True,
            "pil_available": PIL_AVAILABLE,
            "python_version": "3.14"
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "yolo": "loaded" if YOLO_AVAILABLE else "unavailable",
            "opencv": "loaded" if CV2_AVAILABLE else "unavailable",
            "multi_object": "enabled" if YOLO_AVAILABLE else "basic"
        },
        "uptime_seconds": round(time.time() - start_time, 2)
    }

@app.get("/model_info")
async def model_info():
    """Get information about loaded models"""
    return {
        "models": {
            "yolo": {
                "loaded": YOLO_AVAILABLE,
                "version": "v8",
                "classes": len(yolo_model.names) if yolo_model else 0,
                "class_names": list(yolo_model.names.values()) if yolo_model else []
            },
            "opencv": {
                "loaded": CV2_AVAILABLE,
                "version": cv2.__version__ if CV2_AVAILABLE else None
            }
        },
        "emergency_types": list(EMERGENCY_MAPPING.keys()),
        "capabilities": [
            "multi_object_detection",
            "severity_ranking",
            "emergency_classification",
            "video_analysis" if CV2_AVAILABLE else "video_analysis_disabled",
            "batch_processing"
        ]
    }

@app.get("/metrics")
async def get_metrics():
    """Get AI service performance metrics"""
    metrics = {
        "processing": {
            "total_requests": len(performance_metrics['requests']),
            "average_processing_time_ms": round(sum(performance_metrics['processing_times'][-100:]) / len(performance_metrics['processing_times']) if performance_metrics['processing_times'] else 0, 2),
            "min_processing_time_ms": round(min(performance_metrics['processing_times']) if performance_metrics['processing_times'] else 0, 2),
            "max_processing_time_ms": round(max(performance_metrics['processing_times']) if performance_metrics['processing_times'] else 0, 2),
            "errors": len(performance_metrics['errors'])
        },
        "uptime_seconds": round(time.time() - start_time, 2)
    }
    
    # Add system metrics if psutil is available
    if PSUTIL_AVAILABLE:
        metrics["system"] = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage('/').percent
        }
    
    # Add cache metrics
    metrics["cache"] = detection_cache.get_stats()
    
    # Add performance config
    metrics["performance"] = {
        "max_image_size": perf_config.max_image_size,
        "frame_sample_rate": perf_config.frame_sample_rate,
        "min_frame_interval_ms": perf_config.min_frame_interval_ms,
        "cache_enabled": perf_config.cache_enabled,
        "cache_ttl_seconds": perf_config.cache_ttl_seconds
    }
    
    return metrics


@app.get("/performance/config")
async def get_performance_config():
    """Get current performance configuration"""
    return {
        "max_image_size": perf_config.max_image_size,
        "min_image_size": perf_config.min_image_size,
        "yolo_conf_threshold": perf_config.yolo_conf_threshold,
        "fire_conf_threshold": perf_config.fire_conf_threshold,
        "frame_sample_rate": perf_config.frame_sample_rate,
        "min_frame_interval_ms": perf_config.min_frame_interval_ms,
        "cache_enabled": perf_config.cache_enabled,
        "cache_ttl_seconds": perf_config.cache_ttl_seconds,
        "use_async": perf_config.use_async,
        "max_concurrent_requests": perf_config.max_concurrent_requests
    }


@app.post("/performance/config")
async def update_performance_config(
    max_image_size: Optional[Tuple[int, int]] = None,
    frame_sample_rate: Optional[int] = None,
    min_frame_interval_ms: Optional[float] = None,
    cache_enabled: Optional[bool] = None,
    cache_ttl_seconds: Optional[float] = None
):
    """
    Update performance configuration at runtime.
    
    Example:
    {
        "frame_sample_rate": 5,  # Process every 5th frame
        "cache_enabled": true,
        "min_frame_interval_ms": 1000  # Max 1 analysis per second
    }
    """
    if max_image_size:
        perf_config.max_image_size = max_image_size
    if frame_sample_rate is not None:
        perf_config.frame_sample_rate = max(1, frame_sample_rate)
    if min_frame_interval_ms is not None:
        perf_config.min_frame_interval_ms = max(100, min_frame_interval_ms)
    if cache_enabled is not None:
        perf_config.cache_enabled = cache_enabled
    if cache_ttl_seconds is not None:
        perf_config.cache_ttl_seconds = max(0.5, cache_ttl_seconds)
        detection_cache.ttl = perf_config.cache_ttl_seconds
    
    logger.info(f"⚙️ Performance config updated: {perf_config}")
    return await get_performance_config()


@app.post("/performance/reset-cache")
async def reset_detection_cache():
    """Clear the detection cache"""
    detection_cache.cache.clear()
    detection_cache.hits = 0
    detection_cache.misses = 0
    return {"status": "Cache cleared", "stats": detection_cache.get_stats()}


@app.post("/test_fire_detection")
async def test_fire_detection(image: UploadFile = File(...)):
    """
    Debug endpoint to test color-based fire detection directly.
    Bypasses YOLO and uses only color analysis.
    """
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        
        logger.info(f"🔥 Testing fire detection on: {image.filename}")
        
        # Run color-based fire detection with debug enabled
        fire_detections = detect_fire_by_color(img, debug=True)
        
        if fire_detections:
            return {
                "success": True,
                "method": "color_analysis_only",
                "fire_detected": True,
                "detections": fire_detections,
                "total": len(fire_detections),
                "most_severe": fire_detections[0] if fire_detections else None
            }
        else:
            return {
                "success": True,
                "method": "color_analysis_only",
                "fire_detected": False,
                "message": "No fire detected by color analysis",
                "suggestions": [
                    "Fire may be too small or dim",
                    "Image may be too dark",
                    "Try with brighter flame image",
                    "Check if OpenCV is working properly"
                ]
            }
    except Exception as e:
        logger.error(f"Fire detection test failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "Test failed - check if OpenCV and PIL are installed"
        }

@app.post("/analyze")
async def analyze_image(image: UploadFile = File(...)):
    """Analyze image or video for emergency incidents"""
    request_start = time.time()
    
    try:
        # Validate file
        if not image.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Read file data
        data = await image.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Check if it's a video file
        is_video = image.content_type and image.content_type.startswith('video/')
        file_ext = image.filename.split('.')[-1].lower()
        is_video = is_video or file_ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']
        
        logger.info(f"Analyzing: {image.filename} ({len(data)} bytes, is_video: {is_video})")
        
        img = None
        
        # Handle video files
        if is_video and CV2_AVAILABLE:
            logger.info("📹 Video detected, extracting first frame...")
            try:
                img = extract_frame_from_video(data)
                logger.info("✅ First frame extracted from video")
            except Exception as e:
                logger.error(f"Failed to extract frame: {e}")
                # Fallback: try to open as image
                img = Image.open(io.BytesIO(data)).convert("RGB")
                is_video = False
        else:
            # Process as image
            img = Image.open(io.BytesIO(data)).convert("RGB")
            is_video = False
        
        # Use YOLO if available
        if YOLO_AVAILABLE and yolo_model and img:
            detections = analyze_all_objects(img)
            processing_time = round((time.time() - request_start) * 1000, 2)
            performance_metrics['processing_times'].append(processing_time)
            performance_metrics['requests'].append(datetime.now().isoformat())
            
            if detections:
                result = get_most_severe_incident(detections)
                logger.info(f"✅ Detected {len(detections)} objects. Most severe: {result['type']}")
                
                # Check if any fire-related objects were detected
                fire_detected = any(
                    is_fire_related(d.get('raw_label', '')) or 'fire' in d.get('type', '').lower()
                    for d in detections
                )
                
                # If no fire detected, try color-based fire detection as fallback
                if not fire_detected and img and CV2_AVAILABLE:
                    logger.info("🔥 No fire detected by YOLO, trying color-based detection...")
                    color_fire_detections = detect_fire_by_color(img)
                    
                    if color_fire_detections:
                        logger.info(f"✅ Color-based detection found {len(color_fire_detections)} fire region(s)")
                        # Add color detections to the list
                        detections.extend(color_fire_detections)
                        # Re-sort and get most severe
                        detections.sort(key=lambda x: x['weight'], reverse=True)
                        result = get_most_severe_incident(detections)
                
                response_data = {
                    **result,
                    "ai_engine": "YOLOv8 + Color Analysis" if any(d.get('detection_method') == 'color_analysis' for d in detections) else "YOLOv8 (Multi-Object)",
                    "processing_time_ms": processing_time,
                    "is_video": is_video,
                    "image_analysis": {
                        "total_detections": len(detections),
                        "fire_detected_by": "color_analysis" if any(d.get('detection_method') == 'color_analysis' for d in detections) else "yolo",
                        "all_detections": [
                            {
                                "type": d['type'],
                                "confidence": d['confidence'],
                                "severity": d['severity'],
                                "priority": d['priority'],
                                "detection_method": d.get('detection_method', 'yolo')
                            }
                            for d in detections
                        ]
                    }
                }
                
                # Add video info if applicable
                if is_video:
                    response_data["video_info"] = {
                        "source": "first_frame_analysis",
                        "original_file": image.filename
                    }
                
                return response_data
            else:
                # YOLO detected nothing - try color-based fire detection
                color_fire_detections = []
                if img and CV2_AVAILABLE:
                    logger.info("🔥 YOLO detected nothing, trying color-based fire detection...")
                    color_fire_detections = detect_fire_by_color(img)
                
                processing_time = round((time.time() - request_start) * 1000, 2)
                performance_metrics['processing_times'].append(processing_time)
                
                if color_fire_detections:
                    logger.info(f"✅ Color-based detection found fire: {color_fire_detections[0]['type']}")
                    result = get_most_severe_incident(color_fire_detections)
                    return {
                        **result,
                        "ai_engine": "Color Analysis (Fire Detection)",
                        "processing_time_ms": processing_time,
                        "is_video": is_video,
                        "detections": color_fire_detections,
                        "total_objects_detected": len(color_fire_detections),
                        "image_analysis": {
                            "total_detections": len(color_fire_detections),
                            "fire_detected_by": "color_analysis",
                            "all_detections": color_fire_detections
                        }
                    }
                
                logger.info("No objects detected")
                return {
                    "type": "No Clear Emergency Detected",
                    "confidence": 0,
                    "severity": "Low",
                    "priority": "Normal",
                    "ai_engine": "YOLOv8 (Multi-Object)",
                    "processing_time_ms": processing_time,
                    "is_video": is_video,
                    "detections": [],
                    "total_objects_detected": 0
                }
        else:
            # Fallback to simple analysis
            if PIL_AVAILABLE:
                result = simple_multi_analysis(data)
                processing_time = round((time.time() - request_start) * 1000, 2)
                performance_metrics['processing_times'].append(processing_time)
                
                logger.info(f"✅ Simple analysis: {result['type']}")
                
                return {
                    **result,
                    "ai_engine": "Simple Image Analysis (Multi-Object)",
                    "processing_time_ms": processing_time,
                    "is_video": is_video
                }
            else:
                processing_time = round((time.time() - request_start) * 1000, 2)
                return {
                    "type": "Analysis Unavailable",
                    "confidence": 0,
                    "severity": "Low",
                    "priority": "Normal",
                    "ai_engine": "None",
                    "processing_time_ms": processing_time,
                    "is_video": is_video,
                    "error": "No AI models available. Please install dependencies."
                }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing: {str(e)}", exc_info=True)
        performance_metrics['errors'].append(str(e))
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}"
        )

@app.post("/analyze_video")
async def analyze_video_endpoint(video: UploadFile = File(...), frame_interval: int = 2):
    """Analyze video for emergency incidents - extracts and analyzes key frames"""
    request_start = time.time()
    
    if not CV2_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="Video analysis is not available. OpenCV not installed."
        )
    
    try:
        # Validate file
        if not video.filename:
            raise HTTPException(status_code=400, detail="No video file provided")
        
        # Check file type
        allowed_types = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg']
        if video.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )
        
        logger.info(f"Analyzing video: {video.filename} ({video.content_type})")
        
        # Save video temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
            content = await video.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        logger.info(f"Video saved to temp file: {tmp_path}")
        
        # Analyze video frames
        frame_detections = await asyncio.get_event_loop().run_in_executor(
            executor, analyze_video_frames, tmp_path, frame_interval
        )
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        processing_time = round((time.time() - request_start) * 1000, 2)
        performance_metrics['processing_times'].append(processing_time)
        performance_metrics['requests'].append(datetime.now().isoformat())
        
        if not frame_detections:
            return {
                "type": "No Clear Emergency Detected",
                "confidence": 0,
                "severity": "Low",
                "priority": "Normal",
                "ai_engine": "YOLOv8 (Video Analysis)",
                "processing_time_ms": processing_time,
                "frames_analyzed": 0,
                "key_moments": []
            }
        
        # Collect all detections from all frames
        all_detections = []
        for fd in frame_detections:
            all_detections.extend(fd['detections'])
        
        # Get most severe detection
        if all_detections:
            all_detections.sort(key=lambda x: x['weight'], reverse=True)
            result = get_most_severe_incident(all_detections)
        else:
            result = {
                "type": "No Clear Emergency Detected",
                "confidence": 0,
                "severity": "Low",
                "priority": "Normal",
                "detections": []
            }
        
        # Add video-specific information
        result["ai_engine"] = "YOLOv8 (Video Analysis)"
        result["processing_time_ms"] = processing_time
        result["video_analysis"] = {
            "total_frames_analyzed": len(frame_detections),
            "key_moments": [
                {
                    "timestamp": fd['timestamp'],
                    "detections": [
                        {
                            "type": d['type'],
                            "confidence": d['confidence'],
                            "severity": d['severity'],
                            "priority": d['priority']
                        }
                        for d in fd['detections'][:3]  # Top 3 detections per frame
                    ]
                }
                for fd in frame_detections[:5]  # Top 5 key moments
            ]
        }
        
        logger.info(f"✅ Video analysis complete. Analyzed {len(frame_detections)} frames. Most severe: {result['type']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Video analysis failed: {str(e)}", exc_info=True)
        performance_metrics['errors'].append(str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Video analysis failed: {str(e)}"
        )

@app.post("/analyze_batch")
async def analyze_batch(images: List[UploadFile] = File(...)):
    """Analyze multiple images in batch"""
    request_start = time.time()
    
    results = []
    successful = 0
    
    for image in images:
        try:
            result = await analyze_image(image)
            results.append({
                "filename": image.filename,
                "success": True,
                "result": {
                    "type": result.get("type"),
                    "confidence": result.get("confidence"),
                    "severity": result.get("severity"),
                    "priority": result.get("priority"),
                    "processing_time_ms": result.get("processing_time_ms")
                }
            })
            successful += 1
        except Exception as e:
            results.append({
                "filename": image.filename,
                "success": False,
                "error": str(e)
            })
    
    processing_time = round((time.time() - request_start) * 1000, 2)
    performance_metrics['processing_times'].append(processing_time)
    performance_metrics['requests'].append(datetime.now().isoformat())
    
    return {
        "total": len(images),
        "successful": successful,
        "failed": len(images) - successful,
        "processing_time_ms": processing_time,
        "results": results
    }

@app.post("/analyze_all")
async def analyze_all_objects_endpoint(image: UploadFile = File(...)):
    """Get ALL detections without filtering (returns complete list)"""
    request_start = time.time()
    
    try:
        data = await image.read()
        
        if YOLO_AVAILABLE and yolo_model:
            # Check if it's video
            is_video = image.content_type and image.content_type.startswith('video/')
            file_ext = image.filename.split('.')[-1].lower()
            is_video = is_video or file_ext in ['mp4', 'mov', 'avi', 'mkv', 'webm']
            
            img = None
            if is_video and CV2_AVAILABLE:
                try:
                    img = extract_frame_from_video(data)
                except:
                    img = Image.open(io.BytesIO(data)).convert("RGB")
            else:
                img = Image.open(io.BytesIO(data)).convert("RGB")
            
            detections = analyze_all_objects(img)
            processing_time = round((time.time() - request_start) * 1000, 2)
            performance_metrics['processing_times'].append(processing_time)
            
            return {
                "success": True,
                "detections": detections,
                "total": len(detections),
                "processing_time_ms": processing_time
            }
        else:
            return {
                "success": False,
                "error": "YOLO not available"
            }
            
    except Exception as e:
        logger.error(f"Error in analyze_all: {e}")
        performance_metrics['errors'].append(str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze_with_threshold")
async def analyze_with_threshold(
    image: UploadFile = File(...),
    confidence_threshold: float = 0.3
):
    """Analyze image with custom confidence threshold"""
    request_start = time.time()
    
    if confidence_threshold < 0 or confidence_threshold > 1:
        raise HTTPException(status_code=400, detail="Confidence threshold must be between 0 and 1")
    
    try:
        result = await analyze_image(image)
        
        # Filter detections by threshold
        if 'detections' in result:
            result['detections'] = [d for d in result['detections'] if d['confidence'] >= confidence_threshold]
            result['total_objects_detected'] = len(result['detections'])
        
        result['confidence_threshold_used'] = confidence_threshold
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# IMAGE PREPROCESSING FOR PERFORMANCE
# ============================================================================
def preprocess_image(img: Image.Image, target_size: Tuple[int, int] = None) -> Image.Image:
    """
    Preprocess image for faster detection.
    - Resize large images to reduce processing time
    - Skip if already small enough
    """
    if not PIL_AVAILABLE:
        return img
    
    if target_size is None:
        target_size = perf_config.max_image_size
    
    img_w, img_h = img.size
    target_w, target_h = target_size
    
    # Skip if already optimal size
    if img_w <= target_w and img_h <= target_h:
        return img
    
    # Calculate scale to fit within target while maintaining aspect ratio
    scale_w = target_w / img_w
    scale_h = target_h / img_h
    scale = min(scale_w, scale_h)
    
    new_w = int(img_w * scale)
    new_h = int(img_h * scale)
    
    # Use fast resampling
    try:
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        return resized
    except:
        # Fallback for older PIL versions
        return img.resize((new_w, new_h), Image.ANTIALIAS if hasattr(Image, 'ANTIALIAS') else Image.BILINEAR)

def should_throttle_frame(stream_id: str = "default") -> bool:
    """
    Check if we should throttle analysis for this stream.
    Returns True if we should skip this frame.
    """
    now = time.time()
    last_time = frame_last_analysis.get(stream_id, 0)
    
    # Check if minimum interval has passed
    elapsed_ms = (now - last_time) * 1000
    if elapsed_ms < perf_config.min_frame_interval_ms:
        return True
    
    # Update last analysis time
    frame_last_analysis[stream_id] = now
    return False

# ============================================================================
# OPTIMIZED DETECTION FUNCTIONS
# ============================================================================
def analyze_with_boxes(img, stream_id: str = None, skip_preprocessing: bool = False) -> List[Dict[str, Any]]:
    """
    Detect objects and return bounding boxes + tracking-ready info.
    
    Args:
        img: PIL Image
        stream_id: Optional stream ID for throttling
        skip_preprocessing: If True, skip image resizing (for already-small images)
    
    Performance optimizations:
    - Image preprocessing (resize large images)
    - Result caching (avoid re-analyzing similar frames)
    - Frame throttling for streams
    """
    detections = []
    if not YOLO_AVAILABLE or not yolo_model:
        return detections
    
    try:
        # Check cache first
        cached_result = detection_cache.get(img)
        if cached_result is not None:
            return cached_result
        
        # Preprocess image for faster inference
        if not skip_preprocessing and PIL_AVAILABLE:
            original_size = img.size
            img = preprocess_image(img)
            if img.size != original_size:
                logger.debug(f"📐 Resized image from {original_size} to {img.size}")
        
        # Run YOLO detection
        results = yolo_model(img, verbose=False)  # Disable verbose logging for speed
        img_w, img_h = img.size if PIL_AVAILABLE else (640, 480)
        for r in results:
            if len(r.boxes) == 0:
                continue
            for i, box in enumerate(r.boxes):
                label = yolo_model.names[int(box.cls[0])]
                confidence = float(box.conf[0])
                if confidence < 0.30:
                    continue
                # Bounding box in xyxy (normalized 0-1)
                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = xyxy
                cx = round((x1 + x2) / 2 / img_w, 4)
                cy = round((y1 + y2) / 2 / img_h, 4)
                w_norm = round((x2 - x1) / img_w, 4)
                h_norm = round((y2 - y1) / img_h, 4)

                # Calculate bbox area ratio for fire size classification
                bbox_area_ratio = 0.0
                if is_fire_related(label):
                    bbox_area = (x2 - x1) * (y2 - y1)
                    img_area = img_w * img_h
                    bbox_area_ratio = bbox_area / img_area if img_area > 0 else 0.0
                
                incident = map_detection_to_incident(label, confidence, bbox_area_ratio)
                detections.append({
                    **incident,
                    "track_id": f"T{i+1:02d}",
                    "bbox": {
                        "x": round(x1 / img_w, 4),
                        "y": round(y1 / img_h, 4),
                        "w": w_norm,
                        "h": h_norm,
                        "cx": cx,
                        "cy": cy
                    }
                })
        
        # Check if any fire-related objects were detected by YOLO
        fire_detected_yolo = any(
            is_fire_related(d.get('raw_label', '')) or 'fire' in d.get('type', '').lower()
            for d in detections
        )
        
        # If no fire detected by YOLO, try color-based fire detection
        if not fire_detected_yolo and img and CV2_AVAILABLE:
            logger.debug("🔥 No fire detected by YOLO in boxes, trying color analysis...")
            color_fire_detections = detect_fire_by_color(img)
            
            if color_fire_detections:
                logger.info(f"✅ Color-based detection found {len(color_fire_detections)} fire region(s) in stream")
                # Convert color detections to box format with track_ids
                for i, fire_det in enumerate(color_fire_detections):
                    fire_det['track_id'] = f"F{i+1:02d}"  # Fire detection track ID
                    detections.append(fire_det)
        
        detections.sort(key=lambda x: x["weight"], reverse=True)
        
        # Cache the result
        if detections:
            detection_cache.set(img, detections)
        
    except Exception as e:
        logger.error(f"Box detection error: {e}")
    return detections


@app.post("/analyze_boxes")
async def analyze_with_bboxes(image: UploadFile = File(...)):
    """Analyze image and return detections with bounding box coordinates"""
    request_start = time.time()
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        detections = analyze_with_boxes(img)
        processing_time = round((time.time() - request_start) * 1000, 2)
        performance_metrics['processing_times'].append(processing_time)
        performance_metrics['requests'].append(datetime.now().isoformat())
        return {
            "detections": detections,
            "total": len(detections),
            "processing_time_ms": processing_time,
            "ai_engine": "YOLOv8 + BBox",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/stream_analyze")
async def stream_analyze_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time frame analysis with performance optimization.
    
    Performance features:
    - Frame throttling (skip frames if processing too fast)
    - Result caching (avoid re-analyzing similar frames)
    - Image preprocessing (resize large frames)
    
    Client sends: { "streamId": "...", "frame": "<base64 jpeg>" }
    Server sends: { "streamId": "...", "detections": [...], "processing_time_ms": ... }
    """
    await websocket.accept()
    logger.info("🔌 WebSocket stream_analyze client connected")
    frame_counter = 0
    
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            stream_id = payload.get("streamId", "unknown")
            frame_b64 = payload.get("frame", "")

            if not frame_b64:
                continue
            
            # Frame sampling: process every Nth frame
            frame_counter += 1
            if frame_counter % perf_config.frame_sample_rate != 0:
                # Skip this frame but send empty result to keep connection alive
                result = {
                    "streamId": stream_id,
                    "detections": [],
                    "total": 0,
                    "processing_time_ms": 0,
                    "skipped": True,
                    "timestamp": datetime.now().isoformat(),
                    "ai_engine": "YOLOv8 (throttled)"
                }
                await websocket.send_text(json.dumps(result))
                continue
            
            # Check throttling
            if should_throttle_frame(stream_id):
                # Frame throttled, skip analysis
                result = {
                    "streamId": stream_id,
                    "detections": [],
                    "total": 0,
                    "processing_time_ms": 0,
                    "throttled": True,
                    "timestamp": datetime.now().isoformat(),
                    "ai_engine": "YOLOv8 (throttled)"
                }
                await websocket.send_text(json.dumps(result))
                continue

            t0 = time.time()
            try:
                image_bytes = base64.b64decode(frame_b64)
                img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                detections = analyze_with_boxes(img, stream_id=stream_id)
            except Exception as e:
                logger.warning(f"Frame decode error: {e}")
                detections = []

            processing_time = round((time.time() - t0) * 1000, 2)
            result = {
                "streamId": stream_id,
                "detections": detections,
                "total": len(detections),
                "processing_time_ms": processing_time,
                "cache_stats": detection_cache.get_stats(),
                "timestamp": datetime.now().isoformat(),
                "ai_engine": "YOLOv8 + Color Analysis"
            }
            await websocket.send_text(json.dumps(result))

    except WebSocketDisconnect:
        logger.info("🔌 WebSocket stream_analyze client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


# ============================================================================
# ADVANCED DETECTION ENDPOINTS
# ============================================================================

# Global ensemble detector instance (maintains state across calls)
ensemble_detector = None

def get_ensemble_detector():
    """Get or create ensemble detector singleton"""
    global ensemble_detector
    if ensemble_detector is None:
        from advanced_detection import EnsembleDetector, DetectionConfig
        config = DetectionConfig(
            temporal_window=5,
            min_detection_frames=3,
            base_confidence_threshold=0.3,
            velocity_threshold=50
        )
        ensemble_detector = EnsembleDetector(config)
    return ensemble_detector

@app.post("/analyze_advanced")
async def analyze_advanced(image: UploadFile = File(...)):
    """
    Advanced analysis with temporal tracking, behavior analysis, and anomaly detection.
    
    Features:
    - Multi-frame temporal consistency
    - Object tracking with velocity calculation
    - Crowd panic detection
    - Violence/fighting detection
    - Anomaly detection based on historical baseline
    - Scene context analysis
    - Confidence boosting ensemble
    """
    request_start = time.time()
    
    try:
        # Check if advanced detection is available
        try:
            from advanced_detection import EnsembleDetector, DetectionConfig, draw_tracks_on_frame
        except ImportError as e:
            logger.warning(f"Advanced detection not available: {e}")
            # Fallback to basic analysis
            return await analyze_image(image)
        
        # Read and process image
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        
        # Convert to format for OpenCV if needed
        img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR) if CV2_AVAILABLE else None
        
        # Get base YOLO detections
        base_detections = analyze_with_boxes(img)
        
        # Convert to format expected by advanced detector
        detector_input = []
        for det in base_detections:
            bbox = det.get('bbox', {})
            detector_input.append({
                'label': det.get('raw_label', 'unknown'),
                'confidence': det.get('confidence', 0),
                'bbox': (
                    int(bbox.get('x', 0) * img.width),
                    int(bbox.get('y', 0) * img.height),
                    int(bbox.get('w', 0.1) * img.width),
                    int(bbox.get('h', 0.1) * img.height)
                )
            })
        
        # Process with ensemble detector
        detector = get_ensemble_detector()
        ensemble_result = detector.process_frame(detector_input, (img.width, img.height))
        
        processing_time = round((time.time() - request_start) * 1000, 2)
        performance_metrics['processing_times'].append(processing_time)
        performance_metrics['requests'].append(datetime.now().isoformat())
        
        # Determine most severe incident from enhanced detections
        most_severe = None
        if ensemble_result['enhanced_detections']:
            # Find detection with highest effective weight
            max_weight = 0
            for det in ensemble_result['enhanced_detections'][:5]:
                label = det['label']
                # Get base weight from emergency mapping
                base_weight = EMERGENCY_MAPPING.get(label, {}).get('weight', 1)
                # Boost by confidence and speed
                effective_weight = base_weight * det['confidence']
                if det.get('is_fast'):
                    effective_weight *= 1.2
                
                if effective_weight > max_weight:
                    max_weight = effective_weight
                    mapping = EMERGENCY_MAPPING.get(label, {
                        'type': f"Unknown Emergency ({label})",
                        'severity': 'Medium',
                        'priority': 'Medium',
                        'response': 'Monitor and investigate'
                    })
                    most_severe = {
                        'type': mapping.get('type', f"Incident: {label}"),
                        'severity': mapping.get('severity', 'Medium'),
                        'priority': mapping.get('priority', 'Medium'),
                        'response': mapping.get('response', 'Monitor'),
                        'confidence': det['confidence'],
                        'object_type': label
                    }
        
        # Check behavior alerts (override if more severe)
        behavior_severe = None
        for alert in ensemble_result.get('behavior_alerts', []):
            if alert['severity'] in ['Critical', 'High']:
                if behavior_severe is None or alert['severity'] == 'Critical':
                    behavior_severe = {
                        'type': alert['type'],
                        'severity': alert['severity'],
                        'priority': alert['priority'],
                        'confidence': alert['confidence'],
                        'details': alert.get('details', {})
                    }
        
        # Use behavior alert if more severe
        final_result = behavior_severe if behavior_severe else most_severe
        
        # Check anomalies
        anomaly_severe = None
        for anomaly in ensemble_result.get('anomalies', []):
            if anomaly['severity'] in ['Critical', 'High']:
                anomaly_severe = {
                    'type': anomaly['type'],
                    'severity': anomaly['severity'],
                    'priority': anomaly['priority'],
                    'confidence': anomaly['confidence']
                }
                break
        
        # Build comprehensive response
        response = {
            "success": True,
            "ai_engine": "YOLOv8 + Advanced Ensemble (v4.0)",
            "processing_time_ms": processing_time,
            "timestamp": datetime.now().isoformat(),
            
            # Primary incident (most severe)
            "type": final_result['type'] if final_result else "No Clear Emergency Detected",
            "severity": final_result['severity'] if final_result else "Low",
            "priority": final_result['priority'] if final_result else "Normal",
            "confidence": round(final_result['confidence'], 3) if final_result else 0,
            "response_action": final_result.get('response', 'Monitor') if final_result else None,
            
            # Scene context
            "scene_analysis": {
                "scene_type": ensemble_result.get('scene_type', 'unknown'),
                "total_objects": ensemble_result.get('total_tracked_objects', 0),
                "object_distribution": ensemble_result.get('object_counts', {}),
                "is_calibrated": ensemble_result.get('is_calibrated', False)
            },
            
            # Detailed detections
            "enhanced_detections": ensemble_result.get('enhanced_detections', [])[:10],
            
            # Behavior alerts
            "behavior_alerts": ensemble_result.get('behavior_alerts', []),
            "behavior_alert_count": len(ensemble_result.get('behavior_alerts', [])),
            
            # Anomalies
            "anomalies": ensemble_result.get('anomalies', []),
            "anomaly_count": len(ensemble_result.get('anomalies', [])),
            
            # Alternative incidents (if behavior alert was primary)
            "alternative_incidents": [most_severe] if behavior_severe and most_severe else [],
            
            # Processing metadata
            "advanced_features_used": [
                "temporal_tracking",
                "velocity_analysis", 
                "behavior_detection",
                "anomaly_detection",
                "scene_context"
            ]
        }
        
        logger.info(f"✅ Advanced analysis: {response['type']} (confidence: {response['confidence']:.2f})")
        
        return response
        
    except Exception as e:
        logger.error(f"Advanced analysis failed: {e}", exc_info=True)
        performance_metrics['errors'].append(str(e))
        # Fallback to basic analysis
        try:
            image.file.seek(0)
            return await analyze_image(image)
        except:
            raise HTTPException(status_code=500, detail=f"Advanced analysis failed: {str(e)}")


@app.post("/analyze_track_sequence")
async def analyze_track_sequence(frames: List[UploadFile] = File(...)):
    """
    Analyze a sequence of frames for temporal tracking and behavior analysis.
    Upload multiple frames to track objects across time.
    """
    from advanced_detection import EnsembleDetector, DetectionConfig, create_detection_summary
    
    request_start = time.time()
    
    if len(frames) < 2:
        raise HTTPException(status_code=400, detail="Please provide at least 2 frames for sequence analysis")
    
    try:
        # Create fresh detector for this sequence
        config = DetectionConfig(
            temporal_window=len(frames),
            min_detection_frames=2,
            max_track_age=len(frames) + 5
        )
        detector = EnsembleDetector(config)
        
        frame_results = []
        
        for i, frame_file in enumerate(frames):
            data = await frame_file.read()
            img = Image.open(io.BytesIO(data)).convert("RGB")
            
            # Get base detections
            base_detections = analyze_with_boxes(img)
            
            # Convert format
            detector_input = []
            for det in base_detections:
                bbox = det.get('bbox', {})
                detector_input.append({
                    'label': det.get('raw_label', 'unknown'),
                    'confidence': det.get('confidence', 0),
                    'bbox': (
                        int(bbox.get('x', 0) * img.width),
                        int(bbox.get('y', 0) * img.height),
                        int(bbox.get('w', 0.1) * img.width),
                        int(bbox.get('h', 0.1) * img.height)
                    )
                })
            
            # Process frame
            result = detector.process_frame(detector_input, (img.width, img.height))
            frame_results.append(result)
        
        processing_time = round((time.time() - request_start) * 1000, 2)
        
        # Compile sequence analysis
        all_alerts = []
        all_anomalies = []
        max_confidence = 0
        most_severe_frame = None
        
        for i, result in enumerate(frame_results):
            all_alerts.extend(result.get('behavior_alerts', []))
            all_anomalies.extend(result.get('anomalies', []))
            
            # Find max confidence detection
            for det in result.get('enhanced_detections', []):
                if det['confidence'] > max_confidence:
                    max_confidence = det['confidence']
                    most_severe_frame = i
        
        return {
            "success": True,
            "ai_engine": "YOLOv8 + Sequence Tracking",
            "frames_analyzed": len(frames),
            "processing_time_ms": processing_time,
            "sequence_analysis": {
                "total_behavior_alerts": len(all_alerts),
                "unique_alerts": list({a['type'] for a in all_alerts}),
                "total_anomalies": len(all_anomalies),
                "max_confidence": round(max_confidence, 3),
                "most_severe_frame": most_severe_frame,
                "frame_summaries": [create_detection_summary(r) for r in frame_results]
            }
        }
        
    except Exception as e:
        logger.error(f"Sequence analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/detection_config")
async def get_detection_config():
    """Get current advanced detection configuration"""
    try:
        from advanced_detection import DetectionConfig
        config = DetectionConfig()
        return {
            "temporal_window": config.temporal_window,
            "min_detection_frames": config.min_detection_frames,
            "base_confidence_threshold": config.base_confidence_threshold,
            "velocity_threshold": config.velocity_threshold,
            "crowd_threshold": config.crowd_threshold,
            "panic_velocity_threshold": config.panic_velocity_threshold,
            "anomaly_threshold": config.anomaly_threshold
        }
    except ImportError:
        return {"error": "Advanced detection module not available"}


@app.post("/reset_tracker")
async def reset_tracker():
    """Reset the ensemble tracker (useful when switching cameras/scenes)"""
    global ensemble_detector
    ensemble_detector = None
    return {"success": True, "message": "Tracker reset successfully"}


# ============================================================================
# CONFUSION MATRIX & PERFORMANCE EVALUATION ENDPOINTS
# ============================================================================

@app.get("/confusion_matrix")
async def get_confusion_matrix():
    """
    Get complete confusion matrix and performance metrics
    
    Returns:
    - Confusion matrix for object detection
    - Binary classification metrics for alerts
    - Per-class precision, recall, F1 scores
    - Overall accuracy metrics
    """
    try:
        return {
            "success": True,
            "object_detection": object_detection_tracker.get_confusion_matrix_visual(),
            "alert_classification": alert_classification_tracker.calculate_metrics(),
            "recent_alert_accuracy": alert_classification_tracker.get_recent_accuracy(50),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Confusion matrix error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/performance_metrics")
async def get_performance_metrics():
    """Get AI service performance report with all metrics"""
    try:
        report = get_performance_report()
        report['service_status'] = {
            'yolo_available': YOLO_AVAILABLE,
            'opencv_available': CV2_AVAILABLE,
            'numpy_available': NUMPY_AVAILABLE,
            'pil_available': PIL_AVAILABLE
        }
        return report
    except Exception as e:
        logger.error(f"Performance metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/confusion_matrix/reset")
async def reset_confusion_matrix():
    """Reset all confusion matrix statistics (admin use)"""
    try:
        object_detection_tracker.reset()
        alert_classification_tracker.reset()
        return {
            "success": True,
            "message": "Confusion matrix reset successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Reset error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/confusion_matrix/update_alert")
async def update_alert_confusion(data: dict):
    """
    Update binary confusion matrix with ground truth label
    
    Request body:
    {
        "predicted_alert": true/false,
        "actual_alert": true/false,
        "confidence": 0.85,
        "image_id": "optional_id"
    }
    """
    try:
        predicted = data.get('predicted_alert', False)
        actual = data.get('actual_alert', False)
        confidence = data.get('confidence', 0.0)
        
        alert_classification_tracker.update(predicted, actual, confidence)
        
        return {
            "success": True,
            "message": "Alert confusion matrix updated",
            "current_metrics": alert_classification_tracker.calculate_metrics()
        }
    except Exception as e:
        logger.error(f"Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/confusion_matrix/export")
async def export_confusion_matrix():
    """Export confusion matrix data to JSON file"""
    try:
        import os
        export_dir = "exports"
        if not os.path.exists(export_dir):
            os.makedirs(export_dir)
        
        filename = f"confusion_matrix_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(export_dir, filename)
        
        object_detection_tracker.export_to_json(filepath)
        
        return {
            "success": True,
            "filepath": filepath,
            "download_url": f"/exports/{filename}"
        }
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/confusion_matrix/health")
async def get_confusion_matrix_health():
    """Get confusion matrix health and statistics summary"""
    try:
        obj_metrics = object_detection_tracker.calculate_metrics()
        alert_metrics = alert_classification_tracker.calculate_metrics()
        
        return {
            "success": True,
            "object_detection": {
                "total_classes": len(object_detection_tracker.class_names),
                "total_samples": int(np.sum(object_detection_tracker.matrix)),
                "overall_f1": obj_metrics['overall']['micro_f1']
            },
            "alert_classification": {
                "total_analyzed": alert_metrics['total'],
                "accuracy": alert_metrics['accuracy'],
                "false_alarm_rate": alert_metrics['false_alarm_rate'],
                "detection_rate": alert_metrics['detection_rate']
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )