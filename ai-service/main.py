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
from typing import List, Dict, Any, Optional
from collections import defaultdict
import asyncio
from concurrent.futures import ThreadPoolExecutor

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

def map_detection_to_incident(label: str, confidence: float) -> Dict[str, Any]:
    """Map a single detection to Ethiopian-context incident type.
    Objects not in the known classification → 'Out of Common Incidents'."""

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

    return {
        "type":       incident_type,
        "category":   category,
        "confidence": round(confidence, 2),
        "severity":   severity,
        "priority":   priority,
        "response":   response,
        "weight":     weight,
        "raw_label":  label
    }

def analyze_all_objects(img) -> List[Dict[str, Any]]:
    """Detect all objects in the image and return list of incidents"""
    detections = []
    
    try:
        results = yolo_model(img)
        
        for r in results:
            if len(r.boxes) > 0:
                for box in r.boxes:
                    label = yolo_model.names[int(box.cls[0])]
                    confidence = float(box.conf[0])
                    
                    # Only include detections with confidence > 0.3
                    if confidence > 0.3:
                        incident = map_detection_to_incident(label, confidence)
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
    
    return metrics

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
                
                response_data = {
                    **result,
                    "ai_engine": "YOLOv8 (Multi-Object)",
                    "processing_time_ms": processing_time,
                    "is_video": is_video,
                    "image_analysis": {
                        "total_detections": len(detections),
                        "all_detections": [
                            {
                                "type": d['type'],
                                "confidence": d['confidence'],
                                "severity": d['severity'],
                                "priority": d['priority']
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
                processing_time = round((time.time() - request_start) * 1000, 2)
                performance_metrics['processing_times'].append(processing_time)
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

def analyze_with_boxes(img) -> List[Dict[str, Any]]:
    """Detect objects and return bounding boxes + tracking-ready info"""
    detections = []
    if not YOLO_AVAILABLE or not yolo_model:
        return detections
    try:
        results = yolo_model(img)
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

                incident = map_detection_to_incident(label, confidence)
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
        detections.sort(key=lambda x: x["weight"], reverse=True)
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
    WebSocket endpoint for real-time frame analysis.
    Client sends: { "streamId": "...", "frame": "<base64 jpeg>" }
    Server sends: { "streamId": "...", "detections": [...], "processing_time_ms": ... }
    """
    await websocket.accept()
    logger.info("🔌 WebSocket stream_analyze client connected")
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            stream_id = payload.get("streamId", "unknown")
            frame_b64 = payload.get("frame", "")

            if not frame_b64:
                continue

            t0 = time.time()
            try:
                image_bytes = base64.b64decode(frame_b64)
                img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                detections = analyze_with_boxes(img)
            except Exception as e:
                logger.warning(f"Frame decode error: {e}")
                detections = []

            processing_time = round((time.time() - t0) * 1000, 2)
            result = {
                "streamId": stream_id,
                "detections": detections,
                "total": len(detections),
                "processing_time_ms": processing_time,
                "timestamp": datetime.now().isoformat(),
                "ai_engine": "YOLOv8"
            }
            await websocket.send_text(json.dumps(result))

    except WebSocketDisconnect:
        logger.info("🔌 WebSocket stream_analyze client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )