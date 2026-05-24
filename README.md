# SafeCity+ — AI-Integrated Emergency Response System

> A full-stack, cross-platform public safety ecosystem connecting citizens, field responders, and command authorities through real-time AI-powered incident detection and response coordination.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Roles & Access Control](#roles--access-control)
6. [Features by Module](#features-by-module)
7. [AI Pipeline](#ai-pipeline)
8. [Real-Time Communication](#real-time-communication)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Installation & Setup](#installation--setup)
12. [Environment Variables](#environment-variables)

---

## Overview

SafeCity+ is a smart city emergency management platform built for Ethiopian public safety infrastructure. It enables:

- **Citizens** to report emergencies via mobile app with one tap (SOS), live video, photo, or CCTV
- **Responders** (Police, Ambulance, Fire, etc.) to receive real-time incident assignments
- **Admins** to monitor all incidents, manage users, view CCTV feeds, and configure the system
- **Super Responders** to coordinate emergency dispatch using AI-powered auto-assignment

---

## System Architecture

```
┌─────────────────┐     Socket.IO / REST      ┌─────────────────────┐
│   Mobile App    │ ◄────────────────────────► │                     │
│  (Expo / RN)    │                            │   Node.js Backend   │
└─────────────────┘                            │   (Express + WS)    │
                                               │                     │
┌─────────────────┐     REST / WebSocket       │   server.js         │
│  Web Dashboard  │ ◄────────────────────────► │   Port: 5000        │
│   (React.js)    │                            └────────┬────────────┘
└─────────────────┘                                     │
                                                        │ HTTP
                                               ┌────────▼────────────┐
                                               │    AI Service        │
                                               │  (Python / FastAPI)  │
                                               │  YOLOv8 — Port 8000  │
                                               └─────────────────────┘
                                                        │
                                               ┌────────▼────────────┐
                                               │  MySQL Database      │
                                               │  safecity_db         │
                                               └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo), TypeScript, Socket.IO Client, expo-camera, expo-av |
| Web Dashboard | React.js, React Router, Tailwind CSS, Axios, Socket.IO Client |
| Backend | Node.js, Express.js v5, Socket.IO v4, JWT, Multer, Bcrypt, Twilio |
| Database | MySQL, Sequelize ORM |
| AI Service | Python, FastAPI, YOLOv8 (Ultralytics), OpenCV, WebSockets |
| Real-Time | Socket.IO (bidirectional events) |
| Auth | JWT (JSON Web Tokens) + bcrypt password hashing |

---

## Project Structure

```
SafeCityPlus/
├── backend/                    # Node.js API server
│   ├── config/                 # DB connection config
│   ├── controllers/            # Auth & incident business logic
│   ├── middleware/             # JWT auth middleware
│   ├── routes/
│   │   ├── authRoutes.js       # Login / register
│   │   ├── adminRoutes.js      # Admin-only operations
│   │   ├── cctvRoutes.js       # Cameras, alerts, recordings
│   │   ├── incidentRoutes.js   # Incident CRUD
│   │   ├── usersRoutes.js      # User management
│   │   └── superResponderRoutes.js  # SuperResponder API
│   ├── uploads/                # Stored incident media files
│   └── server.js               # Entry point, Socket.IO handlers
│
├── dashboard/                  # React web application
│   └── src/
│       ├── auth/
│       │   └── Login.js        # Two-panel login (form + image)
│       ├── layout/             # Sidebars per role
│       ├── pages/
│       │   ├── HomePage.js               # Public landing page
│       │   ├── AdminDashboard.js         # Admin overview
│       │   ├── AdminCCTV.js              # Camera management
│       │   ├── AdminUsers.js             # User management
│       │   ├── AdminIncidentLogs.js      # Incident history
│       │   ├── AdminAnalytics.js         # Charts & heatmap
│       │   ├── AdminResponders.js        # Responder tracking
│       │   ├── AdminSettings.js          # System config
│       │   ├── LiveStreamViewer.js       # Watch mobile streams
│       │   ├── ResponderDashboard.js     # Responder home
│       │   ├── ResponderIncidents.js     # Assigned incidents
│       │   ├── ResponderCCTV.js          # Responder camera view
│       │   ├── ResponderSettings.js      # Responder preferences
│       │   ├── SuperResponderDashboard.js  # Command center
│       │   ├── SuperResponderIncidents.js  # AI incident queue
│       │   └── SuperResponderSettings.js   # AI auto-assign config
│       └── hooks/              # useSocket real-time hook
│
├── mobile-app/                 # Expo React Native app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx       # Home + SOS button
│   │   │   ├── emergency.tsx   # Emergency contacts
│   │   │   ├── reports.tsx     # Incident reports
│   │   │   └── map.tsx         # Live map
│   │   ├── cctv.tsx            # CCTV monitor
│   │   ├── live-stream.tsx     # Live streaming + AI overlay
│   │   ├── camera.tsx          # Photo/video capture
│   │   └── tips.tsx            # Safety tips
│   ├── components/             # Shared UI components
│   ├── services/               # WebSocket & API services
│   └── utils/                  # Location helpers
│
└── ai-service/                 # Python AI detection service
    ├── main.py                 # FastAPI + YOLOv8 inference
    ├── yolov8n.pt              # YOLOv8 nano model weights
    └── requirements.txt        # Python dependencies
```

---

## Roles & Access Control

| Role | Access | Description |
|---|---|---|
| **Citizen** | Mobile App | Report incidents, use SOS, stream live video |
| **Responder** | Web + Mobile | View & update assigned incidents, CCTV access |
| **Admin** | Web Dashboard | Full system control — users, incidents, CCTV, analytics |
| **SuperResponder** | Web Dashboard | Emergency coordination authority, AI auto-dispatch control |

### Role Badges (Web UI)
- Admin → Blue
- Responder → Green
- SuperResponder → Orange

---

## Features by Module

### 📱 Mobile App

#### Home Screen
- Animated pulsing **SOS button** — tap to open reporting modal
- **SOS Modal** (bottom sheet) with 3 options:
  - 📹 **CCTV** *(default, highlighted blue)* — opens CCTV monitor
  - 📷 **Photo** — opens camera in photo mode
  - 🎬 **Video** — opens camera in video mode
- Recent incidents feed
- Quick action tiles: CCTV, Live Map, Safety Tips, Reports

#### CCTV Monitor
- Grid / List view toggle
- Filter tabs: All, Active, Live, Offline
- Stats bar: Total, Active, Live, Offline, Alerts
- Live banner when active streams exist
- Camera detail modal with:
  - Live video feed (HLS via expo-av)
  - AI bounding box overlay
  - Tabs: Feed / Info / Recordings
  - Quick actions: Record, Save Clip, Share, Audio
  - Incident report button

#### Live Streaming
- Streams frames to backend every **800ms** (~1.2 fps) at 480px
- Sends separate AI analysis frame every **~2.4s** at 640px
- **No shutter sound** during frame capture (`shutterSound: false`)
- Real-time AI bounding box overlay on camera feed
- AI alert banner for detected incidents
- Styled **toast notifications** (replaces native Alert):
  - ✅ Green — Stream Started
  - 🔵 Blue — Stream Ended
- HUD: LIVE pill, viewer count, duration timer, frame counter
- Controls: flip camera, torch, AI toggle, end stream

#### Emergency Screen
- Emergency contact list (Police, Ambulance, Fire)
- Custom contacts (add/remove)
- One-tap SMS with GPS coordinates
- Location sharing via native share sheet

---

### 🌐 Web Dashboard

#### Public Homepage (`/`)
- Fixed **white navbar** (always white, dark text)
- Hero section with background image, gradient overlay
- Features, About, Contact sections
- Mobile-responsive hamburger menu

#### Login Page (`/login`)
- Two-panel layout: form (left) + decorative image (right)
- Mobile responsive: image hidden on small screens
- JWT token stored on successful login
- Redirects by role after login

#### Admin Dashboard
- Live stats: total incidents, active, resolved
- Recent incident feed
- Live stream viewer panel
- Responder status overview

#### Admin CCTV
- Full camera registry management
- Add / edit / delete cameras
- View live stream feeds
- Alert history per camera
- Recording management

#### Admin Users
- Create, edit, deactivate users
- Assign roles with badge display
- Search and filter

#### Admin Analytics
- Incident charts (bar, line, pie)
- Heatmap of incident locations
- Time-based trend analysis

#### Responder Dashboard
- Assigned incidents list
- Real-time `incident-assigned` socket notification
- Map view of assignments
- Status update (Pending → In Progress → Resolved)

#### SuperResponder Dashboard *(Command Center)*
- Live AI incident ticker
- Full incident queue from AI detections
- Manual assignment modal
- **AI auto-assign toggle** (enable/disable automatic dispatch)
- Incident expand/resolve UI

---

## AI Pipeline

```
Mobile Camera Frame (640px JPEG, base64)
        │
        ▼ Socket.IO: ai-analyze-frame
Backend server.js handler
        │
        ▼ HTTP POST
FastAPI AI Service (YOLOv8n inference)
        │
        ├── Detections → bounding boxes array
        │        └── Emitted back as: ai-detection
        │               └── Mobile: renders bounding boxes on camera
        │
        └── isAlert = true?
                │
                ▼
         CATEGORY_MAP lookup
         ┌─────────────────────────────────────────────────┐
         │ Vehicle Collision → Traffic Police + Ambulance   │
         │ Fire / Smoke      → Fire Brigade                 │
         │ Medical Emergency → Ambulance / Medical          │
         │ Violence / Crime  → Armed Police                 │
         │ Road Blockage     → Traffic Police + Road Safety │
         │ Crowd Panic       → Armed Police + Ambulance     │
         │ Construction Acc. → Construction Safety          │
         │ Flood / Disaster  → Disaster Management          │
         └─────────────────────────────────────────────────┘
                │
                ▼
         Insert → ai_incidents table
         Emit   → new-ai-incident  (SuperResponder dashboard)
         Emit   → incident-assigned (Responder real-time notif)
```

**YOLOv8 detects:** person, car, truck, bus, motorcycle, bicycle, fire, accident, and 10+ more object classes with confidence scores and bounding box coordinates.

---

## Real-Time Communication

All real-time features use **Socket.IO v4**.

### Events: Mobile → Server
| Event | Payload | Description |
|---|---|---|
| `start-stream` | streamId, cameraName, location, userId | Begin live stream session |
| `stop-stream` | streamId | End stream and notify viewers |
| `stream-frame` | streamId, frame (base64), timestamp | Raw 480px stream frame |
| `ai-analyze-frame` | streamId, frame (base64), timestamp | 640px frame for AI inference |

### Events: Server → Client
| Event | Payload | Description |
|---|---|---|
| `frame-received` | — | Frame delivery acknowledgment |
| `viewer-joined` | viewerCount | New viewer connected |
| `viewer-left` | viewerCount | Viewer disconnected |
| `ai-detection` | detections[], isAlert, decision | AI inference result |
| `stream-error` | error message | Stream failure notification |
| `new-ai-incident` | incident object | New AI-detected incident (SuperResponder) |
| `incident-assigned` | assignment details | Real-time responder notification |

---

## Database Schema

```sql
-- Core tables
users              (id, fullName, email, password, role, created_at)
incidents          (id, type, description, location, lat, lng, image_url,
                    status, priority, reported_by, created_at)

-- CCTV
cctv_cameras       (id, camera_name, location_name, stream_url, status,
                    resolution, is_recording, last_active, recording_count)
cctv_alerts        (id, camera_id, camera_name, incident_type, is_viewed, created_at)
recordings         (id, camera_id, start_time, duration, file_url)

-- AI / SuperResponder
ai_incidents       (id, decision, severity, incident_category, response_action,
                    accident_confidence, assigned_to_types JSON,
                    assigned_by, status, created_at)
system_settings    (key, value)
                   -- Default: ai_auto_assign = 'true'
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new user |

### Incidents
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/incidents` | List all incidents |
| POST | `/api/incidents` | Create incident (with image upload) |
| PUT | `/api/incidents/:id` | Update incident status |

### CCTV
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cctv/cameras` | List all cameras |
| GET | `/api/cctv/alerts` | List all alerts |
| PUT | `/api/cctv/alerts/:id/view` | Mark alert as viewed |
| GET | `/api/cctv/cameras/:id/recordings` | Camera recordings |
| GET | `/api/streams` | Active live streams |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | All users |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Remove user |

### SuperResponder
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/super-responder/incidents` | All AI incidents |
| GET | `/api/super-responder/incidents/:id` | Single AI incident |
| POST | `/api/super-responder/incidents/:id/assign` | Manual assign |
| PUT | `/api/super-responder/incidents/:id/status` | Update status |
| GET | `/api/super-responder/settings` | Get system settings |
| PUT | `/api/super-responder/settings` | Update settings (AI toggle) |

---

## Installation & Setup

### Prerequisites
- Node.js v16+
- MySQL Server (with `safecity_db` schema)
- Python 3.9+ with pip
- Expo Go app on mobile device (or Android emulator)

---

### 1. Clone the Repository

```bash
git clone https://github.com/simegnewcs/SafeCityPlus.git
cd SafeCityPlus
```

---

### 2. Database Setup

Open MySQL Workbench and create the database:

```sql
CREATE DATABASE safecity_db;
```

The backend auto-runs migrations on startup via `runMigrations()` in `server.js`.

---

### 3. Backend

```bash
cd backend
npm install
node server.js
```

Backend runs on **http://localhost:5000**

---

### 4. Web Dashboard

```bash
cd dashboard
npm install
npm start
```

Dashboard runs on **http://localhost:3000**

---

### 5. Mobile App

```bash
cd mobile-app
npm install
npx expo start
```

- Scan the QR code with **Expo Go** on your phone
- Or press `a` for Android emulator / `w` for web browser

---

### 6. AI Service

```bash
cd ai-service

# Create and activate virtual environment (recommended)
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn main:app --port 8000 --reload
```

AI service runs on **http://localhost:8000**

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
JWT_SECRET=SafeCityPlus2025EthiopiaGov

# MySQL Configuration
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=safecity_db
DB_PORT=3306
```

> **Important:** Never commit your `.env` file to version control.

---

## Running All Services (Quick Reference)

| Service | Directory | Command | Port |
|---|---|---|---|
| Backend API | `backend/` | `node server.js` | 5000 |
| Web Dashboard | `dashboard/` | `npm start` | 3000 |
| Mobile App | `mobile-app/` | `npx expo start` | — |
| AI Service | `ai-service/` | `uvicorn main:app --port 8000` | 8000 |

---

## License

This project was developed for public safety and smart city research purposes in Ethiopia.

---

*SafeCity+ — Protecting Communities Through Intelligent Technology*