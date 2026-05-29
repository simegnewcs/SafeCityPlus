# SafeCity+ — Complete System Overview & Mind Map

> Last updated: May 29, 2026

---

## 1. System Architecture (High-Level)

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                     USERS / CLIENTS                         │
                    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
                    │  │   Citizen    │  │  Responder   │  │  Admin / Super   │  │
                    │  │  (Mobile)    │  │  (Web + App) │  │   (Web Only)     │  │
                    │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
                    └─────────┼─────────────────┼───────────────────┼────────────┘
                              │                 │                   │
          ┌───────────────────┘                 │                   │
          │  WebSocket / REST                   │                   │
          ▼                                     │                   │
    ┌─────────────────┐                        │                   │
    │   Mobile App    │                        │                   │
    │  (Expo / RN)  │◄─────────────────────────┘                   │
    │   Port: 19000 │              REST / WS / JWT                │
    └────────┬────────┘◄──────────────────────────────────────────┘
             │
             │ Socket.IO (stream frames)
             │ REST (incidents, auth)
             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │                    NODE.JS BACKEND                          │
    │                   (Express + Socket.IO)                     │
    │                      Port: 5000                             │
    │                                                             │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
    │  │  Auth Routes │  │ Incident API │  │  CCTV / Stream   │  │
    │  │  /api/auth/* │  │ /api/incidents│  │   /api/cctv/*    │  │
    │  └──────────────┘  └──────────────┘  └──────────────────┘  │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
    │  │ Admin Routes │  │ Super-Resp   │  │  AI WebSocket    │  │
    │  │/api/admin/*  │  │/api/super-*  │  │ ai-analyze-frame │  │
    │  └──────────────┘  └──────────────┘  └──────────────────┘  │
    │                                                             │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │        Socket.IO Real-Time Engine                   │   │
    │  │  • Stream broadcast (mobile → web viewers)          │   │
    │  │  • AI frame forwarding (mobile → AI service)        │   │
    │  │  • Detection results (AI → mobile overlay)          │   │
    │  │  • Incident assignment (auto → responder notify)      │   │
    │  └─────────────────────────────────────────────────────┘   │
    └──────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
    │   AI SERVICE    │ │    MySQL     │ │  File Storage   │
    │  (Python/Fast)  │ │   Database   │ │   (Uploads)     │
    │   Port: 8000    │ │ safecity_db  │ │                 │
    │                 │ │              │ │ • Incident media│
    │ • YOLOv8 Object │ │ • Users      │ │ • CCTV clips    │
    │   Detection     │ │ • Incidents  │ │ • Recordings    │
    │ • Alert Classif.│ │ • CCTV data  │ │                 │
    │ • Confidence    │ │ • AI alerts  │ └─────────────────┘
    │   Scoring       │ │ • Settings   │
    └─────────────────┘ └──────────────┘
```

---

## 2. Mind Map — Complete Feature Tree

```
SAFE CITY +
│
├── 📱 MOBILE APP (React Native / Expo)
│   ├── Home Tab
│   │   ├── 🚨 SOS Button (animated pulse)
│   │   ├── SOS Modal → CCTV / Photo / Video
│   │   ├── Recent Incidents Feed
│   │   └── Quick Tiles: Map, CCTV, Tips, Reports
│   ├── Emergency Tab
│   │   ├── Contact List (Police, Ambulance, Fire)
│   │   ├── Custom Contacts (add/remove)
│   │   ├── One-tap SMS + GPS
│   │   └── Share Location
│   ├── Reports Tab
│   │   ├── My Past Reports
│   │   └── Report Status Tracker
│   ├── Map Tab
│   │   ├── Live Incident Map
│   │   └── My Location
│   ├── CCTV Monitor
│   │   ├── Camera Grid / List Toggle
│   │   ├── Filter: All / Active / Live / Offline
│   │   ├── Camera Detail Modal
│   │   │   ├── Live Feed (HLS)
│   │   │   ├── AI Bounding Box Overlay
│   │   │   ├── Tabs: Feed / Info / Recordings
│   │   │   └── Actions: Record, Save, Share
│   │   └── Incident Report from Camera
│   ├── Live Streaming
│   │   ├── Stream to Backend (800ms/frame, 480px)
│   │   ├── AI Analysis Frame (640px, ~2.4s)
│   │   ├── Real-time AI Overlay on Camera
│   │   ├── AI Alert Banner
│   │   ├── Toast Notifications (styled)
│   │   ├── HUD: LIVE, Viewers, Duration, FPS
│   │   └── Controls: Flip, Torch, AI Toggle, End
│   └── Safety Tips
│
├── 🌐 WEB DASHBOARD (React.js / Tailwind)
│   ├── Public Pages
│   │   ├── HomePage (Landing)
│   │   │   ├── Navbar, Hero, Features, About, Contact
│   │   │   └── Mobile-responsive
│   │   └── Login Page
│   │       ├── Two-panel layout (form + image)
│   │       ├── JWT Auth
│   │       └── Role-based redirect
│   │
│   ├── 🔵 ADMIN MODULE
│   │   ├── Dashboard (/admin/dashboard)
│   │   │   ├── ✅ LIVE: KPI Stats (7 cards)
│   │   │   ├── ✅ LIVE: CCTV AI count
│   │   │   ├── ✅ LIVE: Incident Trend (7 days)
│   │   │   ├── ✅ LIVE: Priority Split (donut)
│   │   │   ├── ✅ LIVE: Incidents by Type (bar)
│   │   │   ├── ✅ LIVE: Status Overview (donut)
│   │   │   ├── ✅ LIVE: Incident Map (all sources)
│   │   │   └── ✅ LIVE: Recent Incidents Table
│   │   │       └── CCTV badge, Category, Source filter
│   │   ├── Incident Logs (/admin/incidents)
│   │   │   ├── ✅ LIVE: Regular + CCTV incidents merged
│   │   │   ├── ✅ LIVE: Source filter (All / Reporter / CCTV)
│   │   │   ├── ✅ LIVE: Search, Type, Priority, Status filters
│   │   │   ├── ✅ LIVE: CCTV Video Playback modal
│   │   │   ├── ✅ LIVE: Source badges (CCTV red / Reporter blue)
│   │   │   ├── Pagination
│   │   │   └── Export JSON
│   │   ├── CCTV Management (/admin/cctv)
│   │   │   ├── Camera Registry
│   │   │   ├── Add / Edit / Delete cameras
│   │   │   ├── Live Stream Feeds
│   │   │   ├── Alert History
│   │   │   └── Recording Management
│   │   ├── Users (/admin/users)
│   │   │   ├── Create / Edit / Deactivate
│   │   │   ├── Role badges (Admin blue, Responder green, Super orange)
│   │   │   └── Search & Filter
│   │   ├── Responders (/admin/responders)
│   │   │   └── Responder tracking & status
│   │   ├── Analytics (/admin/analytics)
│   │   │   ├── Charts (bar, line, pie)
│   │   │   └── Heatmap
│   │   ├── Heatmap (/admin/heatmap)
│   │   ├── Contacts (/admin/contacts)
│   │   └── Settings (/admin/settings)
│   │
│   ├── 🟢 RESPONDER MODULE
│   │   ├── Dashboard (/responder/dashboard)
│   │   │   ├── ✅ LIVE: Dark theme, real data
│   │   │   ├── ✅ LIVE: Assigned incidents
│   │   │   ├── ✅ LIVE: Stats cards
│   │   │   ├── ✅ LIVE: Live map
│   │   │   └── ✅ LIVE: Activity feed
│   │   ├── Incidents (/responder/incidents)
│   │   │   ├── ✅ LIVE: Regular + CCTV incidents
│   │   │   ├── ✅ LIVE: Filters, Search, Pagination
│   │   │   ├── ✅ LIVE: CCTV Video Playback modal
│   │   │   ├── ✅ LIVE: Film icon → Play recording
│   │   │   ├── ✅ LIVE: Eye icon → Detail modal
│   │   │   └── Status update (Pending → In Progress → Resolved)
│   │   ├── CCTV (/responder/cctv)
│   │   │   ├── Camera grid
│   │   │   ├── Live thumbnails
│   │   │   ├── AI-enhanced live stream modal
│   │   │   ├── ✅ LIVE: Recording playback
│   │   │   └── Incident assignment panel
│   │   └── Settings (/responder/settings)
│   │
│   └── 🟠 SUPER RESPONDER MODULE
│       ├── Dashboard (/super-responder/dashboard)
│       │   ├── ✅ LIVE: Command center
│       │   ├── ✅ LIVE: Incident list with AI data
│       │   ├── ✅ LIVE: Live alert ticker
│       │   ├── ✅ LIVE: AI Auto-Assign toggle
│       │   └── ✅ LIVE: Manual assign modal
│       ├── Incidents (/super-responder/incidents)
│       │   ├── ✅ LIVE: Full AI incident queue
│       │   ├── ✅ LIVE: Expand/resolve UI
│       │   └── Assignment controls
│       ├── CCTV (/super-responder/cctv)
│       │   └── Full CCTV monitoring
│       └── Settings (/super-responder/settings)
│           └── AI configuration
│
├── ⚙️ BACKEND (Node.js / Express / Socket.IO)
│   ├── Authentication
│   │   ├── POST /api/auth/register
│   │   ├── POST /api/auth/login → JWT
│   │   └── JWT Middleware (role-based access)
│   ├── Incident Management
│   │   ├── GET /api/incidents (all regular incidents)
│   │   ├── POST /api/incidents (with media upload)
│   │   ├── PUT /api/incidents/:id/status
│   │   └── File upload via Multer
│   ├── CCTV System
│   │   ├── GET /api/cctv/cameras
│   │   ├── GET /api/cctv/alerts
│   │   ├── PUT /api/cctv/alerts/:id/view
│   │   └── Stream management
│   ├── Admin API
│   │   ├── GET /api/admin/users
│   │   ├── PUT /api/admin/users/:id
│   │   └── DELETE /api/admin/users/:id
│   ├── SuperResponder API
│   │   ├── GET /api/super-responder/incidents
│   │   ├── GET /api/super-responder/incidents/:id
│   │   ├── POST /api/super-responder/incidents/:id/assign
│   │   ├── PUT /api/super-responder/incidents/:id/status
│   │   ├── GET /api/super-responder/recordings
│   │   ├── GET /api/super-responder/recordings/:id/frames
│   │   ├── GET /api/super-responder/settings
│   │   └── PUT /api/super-responder/settings
│   └── Socket.IO Real-Time
│       ├── Mobile → Server
│       │   ├── start-stream / stop-stream
│       │   ├── stream-frame (480px broadcast)
│       │   └── ai-analyze-frame (640px → AI service)
│       └── Server → Clients
│           ├── frame-received (ack)
│           ├── ai-detection (bounding boxes)
│           ├── new-ai-incident (SuperResponder)
│           └── incident-assigned (Responder notify)
│
├── 🤖 AI SERVICE (Python / FastAPI / YOLOv8)
│   ├── Object Detection
│   │   ├── YOLOv8n model inference
│   │   ├── Detects: person, car, truck, bus, motorcycle, bicycle, fire, accident...
│   │   └── Returns: bounding boxes + confidence scores
│   ├── Alert Classification
│   │   ├── Analyzes detections for danger patterns
│   │   └── isAlert = true/false
│   ├── CATEGORY_MAP Auto-Assignment
│   │   ├── Vehicle Collision → Traffic Police + Ambulance
│   │   ├── Fire / Smoke → Fire Brigade
│   │   ├── Medical Emergency → Ambulance / Medical
│   │   ├── Construction Accident → Construction Safety
│   │   ├── Flood / Disaster → Disaster Management
│   │   ├── Violence / Crime → Armed Police
│   │   ├── Road Blockage → Traffic Police + Road Safety
│   │   └── Crowd Panic → Armed Police + Ambulance
│   ├── Confusion Matrix & Performance Evaluation
│   │   ├── Binary classification metrics (TP, FP, TN, FN)
│   │   ├── Per-class precision, recall, F1 scores
│   │   ├── False Alarm Rate tracking
│   │   ├── Detection Rate tracking
│   │   └── Real-time accuracy dashboard
│   └── API Endpoints
│       ├── POST /analyze_boxes (YOLO inference)
│       ├── GET /confusion_matrix (metrics)
│       ├── GET /performance_metrics (full report)
│       ├── POST /confusion_matrix/update_alert (feedback)
│       ├── GET /confusion_matrix/health (status)
│       └── GET /health (service status)
│
└── 🗄️ DATABASE (MySQL — safecity_db)
    ├── Core Tables (Auto-created)
    │   ├── users (id, fullName, email, password, role, phone, created_at)
    │   ├── incidents (id, type, description, location, lat, lng, media_name, media_type, status, priority, reported_by, created_at)
    │   └── notifications (id, user_id, message, type, is_read, created_at)
    ├── CCTV Tables
    │   ├── cctv_cameras (id, camera_name, location_name, stream_url, status, lat, lng, resolution, is_recording, last_active)
    │   ├── cctv_alerts (id, camera_id, camera_name, incident_type, is_viewed, created_at)
    │   └── video_recordings (id, stream_id, camera_id, camera_name, location, start_time, end_time, duration, file_count, created_at)
    ├── AI / SuperResponder Tables
    │   ├── ai_incidents (id, stream_id, recording_id, decision, severity, incident_category, response_action, accident_confidence, assigned_to_types JSON, assigned_by, assigned_by_name, status, priority_score, latitude, longitude, location, ai_metadata, created_at)
    │   ├── ai_feedback (id, incident_id, stream_id, was_correct, actual_alert, notes, user_id, created_at) — Ground truth for confusion matrix
    │   ├── system_settings (key, value) → ai_auto_assign = 'true'
    │   └── password_reset_tokens (id, user_id, token, expires_at, used)
    └── Emergency Tables
        └── emergency_contacts (id, name, phone, type, is_default, created_at)
```

---

## 3. What Works Successfully (✅ LIVE Features)

### Authentication & Authorization
| Feature | Status |
|---------|--------|
| JWT Login/Register | ✅ Working |
| Role-based access control (4 roles) | ✅ Working |
| Password reset flow | ✅ Working |
| Auto-redirect by role after login | ✅ Working |

### Incident Reporting
| Feature | Status |
|---------|--------|
| Mobile photo/video capture | ✅ Working |
| Media upload to backend | ✅ Working |
| GPS location capture | ✅ Working |
| Incident status tracking (Pending → Resolved) | ✅ Working |
| Admin incident logs with filters | ✅ Working |

### AI Detection & Auto-Assignment
| Feature | Status |
|---------|--------|
| YOLOv8 real-time object detection | ✅ Working |
| Bounding box overlay on mobile camera | ✅ Working |
| Alert classification (isAlert) | ✅ Working |
| CATEGORY_MAP auto-responder assignment | ✅ Working |
| AI incident insertion to DB | ✅ Working |
| Real-time responder notification | ✅ Working |
| AI auto-assign toggle (enable/disable) | ✅ Working |

### CCTV System
| Feature | Status |
|---------|--------|
| Camera registry (add/edit/delete) | ✅ Working |
| Live stream broadcast (mobile → web) | ✅ Working |
| Stream frame capture | ✅ Working |
| Recording management | ✅ Working |
| Video playback by recording ID | ✅ Working |
| Recording playback in ResponderIncidents | ✅ Working |
| Recording playback in AdminIncidentLogs | ✅ Working |
| CCTV incident badges in tables | ✅ Working |

### Real-Time Communication
| Feature | Status |
|---------|--------|
| Socket.IO stream broadcasting | ✅ Working |
| AI frame forwarding to AI service | ✅ Working |
| Detection results back to mobile | ✅ Working |
| New AI incident alert (SuperResponder) | ✅ Working |
| Incident assignment notification (Responder) | ✅ Working |

### Dashboard Analytics
| Feature | Status |
|---------|--------|
| Admin Dashboard with CCTV data | ✅ Working |
| Admin Incident Logs with CCTV filter | ✅ Working |
| Responder Dashboard (dark theme) | ✅ Working |
| SuperResponder Dashboard (command center) | ✅ Working |
| Charts: trend, priority, status, type | ✅ Working |
| Live incident map | ✅ Working |

### Data Integration
| Feature | Status |
|---------|--------|
| Regular + CCTV incidents merged | ✅ Working |
| Source filter (Reporter / CCTV) | ✅ Working |
| CCTV badge display in tables | ✅ Working |
| Video playback modal across dashboards | ✅ Working |

### AI Performance Evaluation (Confusion Matrix)
| Feature | Status |
|---------|--------|
| Binary classification metrics (TP, FP, TN, FN) | ✅ Working |
| Alert accuracy tracking | ✅ Working |
| False alarm rate monitoring | ✅ Working |
| Detection rate (recall) tracking | ✅ Working |
| Precision & F1 score calculation | ✅ Working |
| Per-class object detection metrics | ✅ Working |
| Admin Analytics dashboard integration | ✅ Working |
| Real-time metrics API | ✅ Working |
| Ground truth feedback system | ✅ Working |
| IoU-based detection matching | ✅ Working |

---

## 4. Step-by-Step System Flow

### Flow 1: Citizen Reports an Incident (Mobile)

```
Step 1: User opens Mobile App → taps 🚨 SOS button
        │
Step 2: SOS Modal appears → User selects: CCTV / Photo / Video
        │
Step 3A (Photo): Camera opens → captures image → GPS captured
        │              → User adds description, location
        │              → POST /api/incidents with image (multipart)
        │              → Backend saves to uploads/ + inserts DB
        │              → Incident appears in Admin/Responder dashboards
        │
Step 3B (Video): Camera opens → records video → GPS captured
        │              → Same flow as Photo
        │
Step 3C (CCTV): Opens CCTV monitor → views live cameras
        │              → Can report incident from camera view
        │
Step 4: Admin sees new incident in Dashboard + Incident Logs
Step 5: Responder sees assignment if auto-assigned
Step 6: Status updates: Pending → In Progress → Resolved
```

### Flow 2: AI Auto-Detection & Assignment (Mobile Stream)

```
Step 1: User opens Live Streaming in Mobile App
        │
Step 2: App starts stream → Socket: start-stream
        │
Step 3: App sends frames every 800ms → Socket: stream-frame (480px)
        │       → Backend broadcasts to web viewers
        │
Step 4: App sends AI frame every ~2.4s → Socket: ai-analyze-frame (640px)
        │       → Backend forwards to AI Service
        │
Step 5: AI Service (YOLOv8) processes frame
        │       → Detects objects, generates bounding boxes
        │       → Classifies: isAlert = true?
        │
Step 6A: No Alert → results sent back → Mobile renders bounding boxes
        │
Step 6B: Alert Detected → AI determines incident_category
        │       → AI Service analyzes severity
        │       →
Step 7: Backend receives alert result
        │       → Looks up CATEGORY_MAP
        │       → Example: "Fire/Smoke" → assigned_to_types = ["Fire Brigade"]
        │
Step 8: Backend inserts into ai_incidents table
        │       → Emits: new-ai-incident → SuperResponder Dashboard
        │       → Emits: incident-assigned → Responder Dashboard
        │
Step 9: SuperResponder sees alert in real-time ticker
Step 10: Assigned Responder sees notification + incident in their list
Step 11: Responder can open CCTV video playback to see the recording
Step 12: Responder updates status → Resolved
```

### Flow 3: Admin Monitoring Dashboard

```
Step 1: Admin logs in → redirected to /admin/dashboard
        │
Step 2: Dashboard fetches:
        │       → GET /api/incidents (regular incidents)
        │       → GET /api/super-responder/incidents (CCTV incidents)
        │       → Merges both lists
        │
Step 3: Dashboard displays:
        │       → 7 stat cards (Total, CCTV AI, Pending, In Progress, Resolved, High Priority, Resolution Rate)
        │       → Trend chart (7 days)
        │       → Priority donut
        │       → Type bar chart
        │       → Status donut
        │       → Live incident map
        │       → Recent incidents table (with CCTV badges)
        │
Step 4: Admin navigates to /admin/incidents
        │       → Full incident logs with all filters
        │       → Can filter by Source: All / Reporter / CCTV
        │       → CCTV incidents show "CCTV Video" button
        │       → Click opens recording playback modal
        │
Step 5: Admin navigates to /admin/cctv
        │       → Camera registry management
        │       → Live feeds
        │       → Alert history
```

### Flow 4: Responder Handling an Incident

```
Step 1: Responder logs in → redirected to /responder/dashboard
        │
Step 2: Dashboard shows:
        │       → Assigned incidents (from DB)
        │       → Real-time socket: incident-assigned
        │       → Stats cards, live map, activity feed
        │
Step 3: Responder navigates to /responder/incidents
        │       → Table shows: Regular + CCTV incidents
        │       → For CCTV: Film icon → opens video playback
        │       → For CCTV: Eye icon → opens detail modal
        │       → For Reporter: Eye icon → opens detail modal
        │
Step 4: Responder clicks Film icon on CCTV incident
        │       → Frontend calls openRecordingForIncident()
        │       → Tries recording_id first
        │       → Falls back to stream_id lookup
        │       → GET /api/super-responder/recordings/:id/frames
        │       → Modal opens with frame-by-frame playback
        │       → Play/Pause, scrubber, prev/next, restart
        │
Step 5: Responder updates status → Resolved
        │       → PUT /api/incidents/:id or /super-responder/:id/status
        │       → Dashboard refreshes
```

### Flow 5: SuperResponder Command Center

```
Step 1: SuperResponder logs in → /super-responder/dashboard
        │
Step 2: Dashboard shows:
        │       → Live AI incident ticker (real-time)
        │       → Incident list with expand/resolve
        │       → AI Auto-Assign toggle switch
        │       → Manual assign modal
        │
Step 3: When AI detects incident:
        │       → Socket event: new-ai-incident
        │       → Ticker updates
        │       → Incident appears in list
        │
Step 4: SuperResponder actions:
        │       → Toggle AI auto-assign ON/OFF
        │       → Manually assign incident to responder types
        │       → Expand incident for details
        │       → Resolve incident
        │
Step 5: Settings page:
        │       → Configure AI auto-assign behavior
```

---

## 5. Data Flow Diagram (Simplified)

```
┌────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                   │
└────────────────────────────────────────────────────────────────────┘

[MOBILE APP]                        [WEB DASHBOARD]
     │                                    │
     │ 1. Report Incident                 │ 4. View Incidents
     │    (photo/video + GPS)             │    (regular + CCTV)
     │                                    │
     ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (Port 5000)                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  REST API   │◄──►│   MySQL DB  │    │   Socket.IO Server  │ │
│  │             │    │ safecity_db │    │                     │ │
│  │ /incidents │    │             │    │ • Stream broadcast  │ │
│  │ /auth      │    │ • users     │    │ • AI frame routing  │ │
│  │ /cctv      │    │ • incidents │    │ • Real-time alerts  │ │
│  │ /admin/*   │    │ • ai_incidents    │ • Assignment notify │ │
│  │ /super-*   │    │ • cctv_cameras    │                     │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                                    │                  │
│         │ 2. Forward AI frame                │                  │
│         │    (base64 JPEG)                   │                  │
│         ▼                                    │                  │
│  ┌───────────────────────────────────────────┘                  │
│  │                                                              │
│  │ 3. AI Detection Result → Auto-insert ai_incidents            │
│  │    → Emit new-ai-incident (SuperResponder)                   │
│  │    → Emit incident-assigned (Responder)                      │
│  └──────────────────────────────────────────────────────────────┘
│         │
│         ▼
│  ┌─────────────────┐
│  │   AI SERVICE    │
│  │  (Port 8000)    │
│  │  YOLOv8 + FastAPI│
│  │                 │
│  │ /analyze_boxes  │
│  │ /health         │
│  └─────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Service Ports Summary

| Service | Port | URL |
|---------|------|-----|
| Backend API | 5000 | http://localhost:5000 |
| Web Dashboard | 3000 | http://localhost:3000 |
| AI Service | 8000 | http://localhost:8000 |
| Mobile App | 19000 | Expo Go / Metro bundler |
| MySQL DB | 3306 | localhost:3306/safecity_db |

---

## 7. Key Files Reference

| Component | File Path |
|-----------|-----------|
| Backend Entry | `backend/server.js` |
| AI Service | `ai-service/main.py` |
| Admin Dashboard | `dashboard/src/pages/AdminDashboard.js` |
| Admin Incidents | `dashboard/src/pages/AdminIncidentLogs.js` |
| Responder Dashboard | `dashboard/src/pages/ResponderDashboard.js` |
| Responder Incidents | `dashboard/src/pages/ResponderIncidents.js` |
| Responder CCTV | `dashboard/src/pages/ResponderCCTV.js` |
| SuperResponder Dashboard | `dashboard/src/pages/SuperResponderDashboard.js` |
| SuperResponder Incidents | `dashboard/src/pages/SuperResponderIncidents.js` |
| Auth Routes | `backend/routes/authRoutes.js` |
| SuperResponder Routes | `backend/routes/superResponderRoutes.js` |
| CCTV Routes | `backend/routes/cctvRoutes.js` |
| **Confusion Matrix Module** | `ai-service/confusion_matrix.py` |
| **Confusion Matrix UI** | `dashboard/src/components/ConfusionMatrix.js` |
| **AI Feedback DB** | `backend/create_ai_feedback_table.sql` |

---

*SafeCity+ — Protecting Communities Through Intelligent Technology*
