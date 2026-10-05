# 📘 improX Pro — Master System Technical Handoff Document

> **Continuity Note:** All future developers, DevOps engineers, and AI agents can read this document (`HANDOFF_GUIDE.md`) to immediately operate, manage, build, and deploy the improX Pro ecosystem seamlessly.

---

## 1. 🖥️ Server Infrastructure & VPS Access

The entire platform backend, database, and admin dashboard are hosted 24/7 on **Hostinger VPS**.

| Setting | Value |
| :--- | :--- |
| **Server Hostname** | `srv1847902.hstgr.cloud` |
| **Public IPv4 Address** | `200.141.2.53` |
| **Operating System** | Ubuntu 24.04 LTS |
| **SSH Username** | `root` |
| **SSH Command** | `ssh root@200.141.2.53` |
| **SSH Default Port** | `22` |
| **Application Path on VPS** | `/root/improx-monitor` |
| **Live Super Admin Panel URL** | `http://200.141.2.53` |
| **Backend API URL** | `http://200.141.2.53:4000` (or Nginx proxy `/api`) |
| **OTA Updates URL** | `http://200.141.2.53/updates/` |

> [!TIP]
> **Hostinger Panel Reset**: If password access is needed, log in to [Hostinger hPanel](https://hpanel.hostinger.com/) → VPS `srv1847902.hstgr.cloud` → Click **Reset password** or launch the Web Console.

---

## 2. 🔑 Admin & Database Credentials

### A. Super Admin Dashboard Login
- **URL**: `http://200.141.2.53`
- **Email**: `monitoradmin@improxgroup.com1234`
- **Password**: `#admin0089000#`
- **Role**: `ADMIN` (Full Super Admin privileges)

### B. Backend Environment & Database (`backend/.env`)
- **Port**: `4000`
- **Database URL**: `postgresql://postgres:postgres@localhost:5432/improx_monitor?schema=public`
- **Database Engine**: PostgreSQL on VPS (`localhost:5432`)
- **JWT Secret**: `improx_ultra_secure_jwt_secret_2026_production_key`
- **Uploads Folder**: `./uploads` (Stores employee screenshots organized by date)

---

## 3. 📂 Git Repository & Source Code Structure

- **Git Repository URL**: `https://github.com/bankarom/monitoring-system.git`
- **Main Branch**: `main`

### Repository Tree Sitemap
```
monitoring-system/
├── desktop-agent/                # Electron Desktop Agent (Client App)
│   ├── src/
│   │   ├── main/main.ts          # Electron main process, power monitor, IPC handlers
│   │   ├── tracking/
│   │   │   ├── activeWindow.ts   # Native C/Win32 & macOS window & hook supervisor
│   │   │   ├── screenshotEngine.ts # Async screen capture engine
│   │   │   └── autoUpdater.ts    # Silent background OTA updater
│   │   ├── api/syncService.ts    # Telemetry batch sync & authentication client
│   │   ├── storage/offlineQueue.ts # Local SQLite/JSON offline log queue
│   │   └── ui/login.html         # Desktop Agent renderer UI
│   └── package.json
│
├── backend/                      # Express.js REST API Backend
│   ├── src/
│   │   ├── server.ts             # Express app initialization & HTTP listener
│   │   ├── controllers/
│   │   │   ├── activityController.ts # Telemetry batching & activity % formulas
│   │   │   ├── adminController.ts    # Analytics, screenshots, employee stats
│   │   │   └── authController.ts     # Login & JWT verification
│   │   ├── utils/seed.ts         # Initial Super Admin seed script
│   │   └── config/prisma.ts      # Prisma Database client singleton
│   ├── prisma/
│   │   └── schema.prisma         # Database models (User, ActivityLog, Screenshot)
│   └── package.json
│
├── frontend/                     # React + Vite Super Admin Dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     # Live employee status grid & metrics
│   │   │   ├── Screenshots.tsx   # High-resolution screenshot viewer
│   │   │   └── Employees.tsx     # Employee account & shift management
│   │   └── App.tsx
│   └── package.json
│
└── .github/workflows/
    └── build-agent.yml           # Automated macOS DMG build CI/CD pipeline
```

---

## 4. 🧮 Activity Level Formula Standard

The system uses a synchronized 10-minute activity formula across both the Desktop Agent and Super Admin Panel:

$$\text{ActivityPercent} = \min\left(100, \text{round}\left(\frac{\text{Keystrokes}}{70} \times 60 + \frac{\text{Mouse Clicks}}{25} \times 40\right)\right)$$

### Target Benchmarks:
- **70 Keystrokes** per 20s sample = 100% Keyboard score (weighted at 60%).
- **25 Mouse Clicks** per 20s sample = 100% Mouse score (weighted at 40%).
- Combined weighted score capped at 100%.

---

## 5. 🛠️ Commands & Build Instructions

### Local Development Setup

#### 1. Backend Server
```bash
cd backend
npm install
npx prisma db push
npm run dev
# Runs on http://localhost:4000
```

#### 2. Super Admin Dashboard
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5000
```

#### 3. Desktop Agent
```bash
cd desktop-agent
npm install
npm run dev
```

### Packaging Windows Installer (`.exe`)
```bash
cd desktop-agent
npm run build
# Output executable: desktop-agent/release/Improx Monitoring System Setup 1.0.0.exe
```

### Building macOS Installer (`.dmg`)
Push commits to `https://github.com/bankarom/monitoring-system.git`. The GitHub Actions workflow (`.github/workflows/build-agent.yml`) will compile the `.dmg` binary automatically under GitHub Releases.

---

## 6. 🔄 Background Over-The-Air (OTA) Updates

When deploying a new Desktop Agent version (e.g. `v1.1.0`):
1. Compile the new Windows executable: `npm run build` inside `desktop-agent`.
2. Upload the compiled executable (`Improx-Agent-Setup-1.1.0.exe`) and updated `latest.yml` to the VPS server directory `/root/improx-monitor/backend/updates/`.
3. Running desktop agents silently check `http://200.141.2.53/updates/latest.yml` every hour, automatically download the update in the background, and apply it upon employee break, clock-out, or app restart.

---

## 7. 🚀 Deploying Updates to Live VPS

Whenever code updates are committed to `main`:
```bash
ssh root@200.141.2.53
cd /root/improx-monitor
git pull origin main
cd backend && npm run build && pm2 restart all
cd ../frontend && npm run build
```
