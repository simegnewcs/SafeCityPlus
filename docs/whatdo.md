SafeCityPlus
│
├── 🎯 PURPOSE
│   └── AI-Integrated Emergency Response System
│       bridging citizens ↔ first responders
│       via ML, Real-time Data, Cross-Platform
│
├── 🏗️ ARCHITECTURE (4-Tier)
│   ├── 📱 Mobile App (React Native / Expo)
│   ├── 💻 Web Dashboard (React.js + Tailwind CSS)
│   ├── ⚙️ Backend API (Node.js + Express + Socket.io)
│   ├── 🧠 AI Service (Python FastAPI + YOLOv8)
│   └── 🗄️ Database (MySQL)
│
├── 📱 MOBILE APP (Citizen-Facing)
│   ├── Auth: Register / Login / Guest Mode
│   ├── SOS: One-touch panic button
│   ├── Emergency Report: Capture image/video → AI analysis
│   ├── Live Stream: Broadcast real-time video to admins
│   ├── CCTV Viewer: Watch surveillance feeds
│   ├── Incident Tracking: View report status & responder location
│   ├── Safety Tips: Educational content
│   └── Admin Dashboard (in-app): Manage incidents
│
├── 💻 WEB DASHBOARD (Admin & Responder)
│   ├── Command Center: Real-time incident monitoring
│   ├── Heatmaps & Analytics Charts
│   ├── Incident Management: Pending → In-Progress → Resolved
│   ├── User Management (Admin/Responder/Citizen roles)
│   ├── Live Stream Viewer: Watch citizen broadcasts
│   ├── CCTV Management
│   └── Multi-role Login (Admin vs Responder views)
│
├── ⚙️ BACKEND (Express + Socket.io)
│   ├── REST API Routes
│   │   ├── /api/auth      → Register, Login (bcrypt)
│   │   ├── /api/incidents → CRUD + status updates
│   │   ├── /api/cctv      → CCTV feed management
│   │   ├── /api/users     → User management
│   │   └── /api/streams   → Active live streams
│   ├── Auth Middleware: JWT-like token via user ID
│   ├── File Upload: Multer (image/video)
│   ├── Real-time: Socket.io
│   │   ├── new_incident → broadcast to dashboard
│   │   ├── Live streaming (start/join/leave/stop/frames)
│   │   └── Viewer count updates
│   └── SMS Alerts: Twilio for Critical/High priority incidents
│
├── 🧠 AI SERVICE (FastAPI on port 8000)
│   ├── YOLOv8n model (object detection)
│   ├── /analyze endpoint: image/video → incident classification
│   ├── Output: type, confidence, severity, priority, detections[]
│   └── Incident types: Fire, Accident, Medical, Violence, etc.
│
├── 🗄️ DATABASE (MySQL — safecity_db)
│   ├── users            → id, full_name, phone, password, role
│   ├── incidents        → id, user_id, type, confidence, severity,
│   │                      priority, media_type, status, lat/lng
│   ├── ai_logs          → detection history per incident
│   ├── video_recordings → mobile video evidence
│   └── cctv_feeds       → surveillance camera data
│
├── 🔄 DATA FLOW
│   Citizen captures media → Mobile sends to Backend →
│   Backend forwards to AI Service → AI returns classification →
│   Backend saves to DB → Socket.io emits to Dashboard →
│   SMS alerts to Responders (if Critical/High)
│
└── 🔑 KEY FEATURES
    ├── AI-powered auto-classification of emergencies
    ├── Real-time WebSocket communication
    ├── Live video streaming (citizen → admin)
    ├── Multi-role system (Citizen / Responder / Admin)
    ├── Geolocation-based incident mapping
    ├── SMS emergency notifications (Twilio)
    └── Guest mode for non-registered users