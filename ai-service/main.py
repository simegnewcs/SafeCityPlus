from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import io
from PIL import Image

app = FastAPI()

# የ YOLOv8 ሞዴልን መጫን (በመጀመሪያ ሲከፈት በራሱ ኢንተርኔት ላይ ያወርደዋል)
model = YOLO('yolov8n.pt') 

@app.get("/")
def home():
    return {"status": "SafeCity+ AI Service is Online"}

@app.post("/analyze")
async def analyze_image(image: UploadFile = File(...)):
    # ምስሉን ማንበብ
    data = await image.read()
    img = Image.open(io.BytesIO(data))

    # በ YOLOv8 መተንተን
    results = model(img)
    
    # በፕሮፖዛሉ ገጽ 5 እና 17 ላይ ባለው መሰረት ውጤቱን ማዘጋጀት
    for r in results:
        if len(r.boxes) > 0:
            box = r.boxes[0] # የመጀመሪያውን የተገኘ አደጋ መውሰድ
            label = model.names[int(box.cls[0])]
            conf = float(box.conf[0])
            
            return {
                "type": label,
                "confidence": round(conf, 2),
                "severity": "High" if conf > 0.8 else "Medium",
                "priority": "Critical" if conf > 0.8 else "High"
            }
            
    # ምንም አደጋ ካልተገኘ የሚመለስ መልስ 
    return {
        "type": "None",
        "confidence": 0,
        "severity": "Low",
        "priority": "Normal"
    }