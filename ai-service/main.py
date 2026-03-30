from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import io
import logging
import time
from datetime import datetime
from typing import List, Dict, Any

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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SafeCity+ AI Service",
    description="AI-powered incident detection with multi-object analysis",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Severity and priority weights for ranking
SEVERITY_WEIGHTS = {
    'Critical': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1
}

PRIORITY_WEIGHTS = {
    'Critical': 4,
    'High': 3,
    'Medium': 2,
    'Normal': 1
}

# Emergency incident types mapping with severity levels
EMERGENCY_MAPPING = {
    # Life-threatening emergencies
    'person': {
        'type': 'Person Collapsed (Medical Emergency)',
        'severity': 'High',
        'priority': 'High',
        'weight': 10
    },
    'fire': {
        'type': 'Fire Emergency',
        'severity': 'Critical',
        'priority': 'Critical',
        'weight': 10
    },
    'smoke': {
        'type': 'Fire/Smoke Detected',
        'severity': 'Critical',
        'priority': 'Critical',
        'weight': 9
    },
    # Vehicle accidents
    'car': {
        'type': 'Car Accident',
        'severity': 'High',
        'priority': 'Critical',
        'weight': 9
    },
    'truck': {
        'type': 'Vehicle Accident (Truck)',
        'severity': 'High',
        'priority': 'Critical',
        'weight': 9
    },
    'bus': {
        'type': 'Vehicle Accident (Bus)',
        'severity': 'High',
        'priority': 'Critical',
        'weight': 9
    },
    'motorcycle': {
        'type': 'Motorcycle Accident',
        'severity': 'High',
        'priority': 'High',
        'weight': 8
    },
    'bicycle': {
        'type': 'Bicycle Accident',
        'severity': 'Medium',
        'priority': 'High',
        'weight': 7
    },
    # Suspicious activities
    'knife': {
        'type': 'Weapon Detected (Knife)',
        'severity': 'Critical',
        'priority': 'Critical',
        'weight': 10
    },
    'gun': {
        'type': 'Weapon Detected (Firearm)',
        'severity': 'Critical',
        'priority': 'Critical',
        'weight': 10
    },
    'scissors': {
        'type': 'Sharp Object Detected',
        'severity': 'High',
        'priority': 'High',
        'weight': 7
    },
    # Medium priority
    'bottle': {
        'type': 'Suspicious Object (Bottle)',
        'severity': 'Medium',
        'priority': 'Medium',
        'weight': 5
    },
    'cell phone': {
        'type': 'Suspicious Activity involving Phone',
        'severity': 'Medium',
        'priority': 'Medium',
        'weight': 4
    },
    'backpack': {
        'type': 'Unattended Baggage',
        'severity': 'Medium',
        'priority': 'Medium',
        'weight': 5
    },
    # Lower priority
    'chair': {
        'type': 'Furniture Obstruction',
        'severity': 'Low',
        'priority': 'Low',
        'weight': 2
    },
    'table': {
        'type': 'Furniture Obstruction',
        'severity': 'Low',
        'priority': 'Low',
        'weight': 2
    }
}

def get_severity_priority(weight: int) -> tuple:
    """Convert weight to severity and priority"""
    if weight >= 9:
        return "Critical", "Critical"
    elif weight >= 7:
        return "High", "High"
    elif weight >= 5:
        return "Medium", "Medium"
    elif weight >= 3:
        return "Medium", "Low"
    else:
        return "Low", "Low"

def map_detection_to_incident(label: str, confidence: float) -> Dict[str, Any]:
    """Map a single detection to incident type"""
    
    label_lower = label.lower()
    
    if label_lower in EMERGENCY_MAPPING:
        mapping = EMERGENCY_MAPPING[label_lower]
        incident_type = mapping['type']
        severity = mapping['severity']
        priority = mapping['priority']
        weight = mapping['weight']
    else:
        # Generic object
        incident_type = f"{label.capitalize()} Related Incident"
        # Adjust based on confidence
        if confidence > 0.85:
            weight = 6
            severity, priority = "Medium", "Medium"
        elif confidence > 0.6:
            weight = 4
            severity, priority = "Medium", "Low"
        else:
            weight = 2
            severity, priority = "Low", "Low"
    
    # Adjust weight based on confidence
    if confidence > 0.9:
        weight += 2
    elif confidence > 0.75:
        weight += 1
    
    return {
        "type": incident_type,
        "confidence": round(confidence, 2),
        "severity": severity,
        "priority": priority,
        "weight": weight,
        "raw_label": label
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
        "version": "2.0.0",
        "features": {
            "multi_object_detection": YOLO_AVAILABLE,
            "severity_ranking": True,
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
            "multi_object": "enabled" if YOLO_AVAILABLE else "basic"
        }
    }

@app.post("/analyze")
async def analyze_image(image: UploadFile = File(...)):
    """
    Analyze image for emergency incidents - DETECTS ALL OBJECTS
    Returns the most severe incident with all detections
    """
    start_time = time.time()
    
    try:
        # Validate file
        if not image.filename:
            raise HTTPException(status_code=400, detail="No image file provided")
        
        # Check file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if image.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
            )
        
        # Read image data
        data = await image.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        logger.info(f"Analyzing: {image.filename} ({len(data)} bytes)")
        
        # Use YOLO if available
        if YOLO_AVAILABLE and yolo_model:
            try:
                img = Image.open(io.BytesIO(data)).convert("RGB")
                
                # DETECT ALL OBJECTS
                detections = analyze_all_objects(img)
                
                processing_time = round((time.time() - start_time) * 1000, 2)
                
                if detections:
                    # Get the most severe incident
                    result = get_most_severe_incident(detections)
                    
                    logger.info(f"✅ Detected {len(detections)} objects. Most severe: {result['type']} (Weight: {result['weight']})")
                    
                    return {
                        **result,
                        "ai_engine": "YOLOv8 (Multi-Object)",
                        "processing_time_ms": processing_time,
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
                else:
                    # No objects detected
                    processing_time = round((time.time() - start_time) * 1000, 2)
                    logger.info("No objects detected")
                    return {
                        "type": "No Objects Detected",
                        "confidence": 0,
                        "severity": "Low",
                        "priority": "Normal",
                        "ai_engine": "YOLOv8 (Multi-Object)",
                        "processing_time_ms": processing_time,
                        "detections": [],
                        "total_objects_detected": 0
                    }
                    
            except Exception as e:
                logger.error(f"YOLO detection failed: {e}")
                # Fall through to simple analysis
        
        # Fallback to simple analysis
        if PIL_AVAILABLE:
            result = simple_multi_analysis(data)
            processing_time = round((time.time() - start_time) * 1000, 2)
            
            logger.info(f"✅ Simple analysis: {result['type']}")
            
            return {
                **result,
                "ai_engine": "Simple Image Analysis (Multi-Object)",
                "processing_time_ms": processing_time
            }
        else:
            processing_time = round((time.time() - start_time) * 1000, 2)
            return {
                "type": "Analysis Unavailable",
                "confidence": 0,
                "severity": "Low",
                "priority": "Normal",
                "ai_engine": "None",
                "processing_time_ms": processing_time,
                "error": "No AI models available. Please install dependencies."
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}"
        )

@app.post("/analyze_all")
async def analyze_all_objects_endpoint(image: UploadFile = File(...)):
    """
    Get ALL detections without filtering (returns complete list)
    """
    start_time = time.time()
    
    try:
        data = await image.read()
        
        if YOLO_AVAILABLE and yolo_model:
            img = Image.open(io.BytesIO(data)).convert("RGB")
            detections = analyze_all_objects(img)
            processing_time = round((time.time() - start_time) * 1000, 2)
            
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
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )