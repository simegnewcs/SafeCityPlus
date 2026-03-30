MOBILE-APP
##################################################################################
 👉Before coding your tasks look the front carfully
# For oppining the front 

#1. open your terminal  and goto mobile-app folder cd mobile-app
#2. run the command npx expo start 
#3. then scan the bundler by using expo app on your phone or simply press w for web view 


###################################################################################

BACKEND

#################################################################################
########################
#backend steps to run 
after you clone from git
#1. cd backend 
#2.node server.js

notice the databse has been connected 

PORT=5000
JWT_SECRET=SafeCityPlus2025EthiopiaGov

# === MySQL CONFIGURATION ===
DB_HOST=localhost
DB_USER=yours...
DB_PASSWORD=  yours... 
DB_NAME=safecity_db
DB_PORT=3306
######################################


Safe City Plus: AI-Integrated Emergency Response SystemSafe City Plus is a cutting-edge emergency management ecosystem designed to bridge the gap between citizens and first responders. 

By leveraging Artificial Intelligence (ML), Real-time Data Streaming, and Cross-Platform integration, it ensures that emergencies are reported, classified, and managed in seconds.
🚀 Core Features
📱 Mobile Ecosystem (Citizen App)
One-Touch SOS: Large, interactive panic button for immediate reporting.

AI-Powered Detection: Integrated camera that uses Machine Learning to automatically identify types of emergencies (Fire, Accidents, Medical).Live Tracking: Users can see the status of their reports and the location of dispatched responders.Quick Actions: 
Fast access to CCTV feeds, safety tips, and incident logs.

💻 Web Command Center (Admin & Responder)Admin Dashboard: Full system oversight with real-time incident heatmaps, analytics charts, and user management.Responder Portal: Specialized interface for field units to view assigned tasks and navigate to emergency locations.Incident Management: 
Ability to update the status of reports (Pending, In-Progress, Resolved).🛠️ Tech StackLayerTechnologyMobile AppReact Native (Expo), Lucide-Icons, Safe Area ContextWeb DashboardReact.js, Tailwind CSS, Axios, React RouterBackendNode.js, Express.jsDatabaseMySQL (Relational Data), MySQL WorkbenchReal-timeSocket.io (WebSockets)Artificial IntelligencePython, FastAPI, TensorFlow/PyTorch
📂 Project ArchitecturePlaintextSafeCityPlus/
├── backend/            # Express API & Socket.io Logic
│   ├── controllers/    # Business logic for Auth & Incidents
│   ├── uploads/        # Storage for emergency image evidence
│   └── server.js       # Entry point for the backend
├── dashboard/          # React Web Application
│   ├── src/auth/       # Multi-role Login & Registration
│   ├── src/pages/      # Admin and Responder specific views
│   └── src/hooks/      # Real-time data hooks (useSocket)
├── mobile-app/         # Expo React Native App
│   ├── app/(tabs)/     # Bottom navigation layout
│   └── app/index.js    # Main UI with SOS pulse animation
└── ai-model/           # FastAPI Image Classification Service

🚦 Installation & Setup1. PrerequisitesNode.js (v16+)MySQL ServerExpo Go (for mobile testing)
2. Database ConfigurationOpen MySQL Workbench.Create a schema named safecity_db.Run the provided SQL migration scripts to create users and incidents tables.
3. Running the BackendBashcd backend
npm install
npm start
4. Running the Web DashboardBashcd dashboard
npm install
npm start
5. Running the Mobile AppBashcd mobile-app
npm install
npx expo start
6. AI-SERVICE
1.Navigate and Activate Environment
First, open a new terminal (separate from your Node.js and React terminals) and enter your AI folder. If you are using a virtual environment (recommended), activate it first.

Bash
# Navigate to the AI folder
cd ai-model

# If using a virtual environment (Windows)
venv\Scripts\activate

# If using a virtual environment (Mac/Linux)
source venv/bin/activate
2. Start the FastAPI Server
Run the following command to start the AI service. The --reload flag is great for development as it restarts the server whenever you change the code.

Bash
uvicorn main:app --port 8000 --reload
main: Refers to your main.py file.

app: Refers to the FastAPI instance created inside that file (e.g., app = FastAPI()).

--host 0.0.0.0: This allows your Mobile App to connect to the AI server over your local Wi-Fi.

use db in backend/config/safecity_db