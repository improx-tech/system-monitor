import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config/environment';
import { socketService } from './services/socketService';
import authRoutes from './routes/authRoutes';
import activityRoutes from './routes/activityRoutes';
import adminRoutes from './routes/adminRoutes';
import employeeRoutes from './routes/employeeRoutes';
import { seedInitialAdmin } from './utils/seed';
import { startHeartbeatSupervisor } from './services/heartbeatService';

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload and updates directory exist
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}
const updatesDir = path.join(__dirname, '../updates');
if (!fs.existsSync(updatesDir)) {
  fs.mkdirSync(updatesDir, { recursive: true });
}

// Serve uploaded screenshots, downloads & auto-update manifests statically
app.use('/uploads', express.static(config.uploadDir));
app.use('/downloads', express.static(path.join(__dirname, '../downloads')));
app.use('/updates', express.static(updatesDir));

// Direct Desktop Agent Download Route (Windows .exe)
app.get(['/download/agent', '/api/download/agent', '/download/agent/win'], (req, res) => {
  let foundPath = '';
  if (fs.existsSync(updatesDir)) {
    const files = fs.readdirSync(updatesDir).filter(f => f.endsWith('.exe') && f.includes('Setup')).sort().reverse();
    if (files.length > 0) {
      foundPath = path.join(updatesDir, files[0]);
    }
  }

  if (!foundPath) {
    const downloadsDir = path.join(__dirname, '../downloads');
    if (fs.existsSync(downloadsDir)) {
      const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.exe')).sort().reverse();
      if (files.length > 0) {
        foundPath = path.join(downloadsDir, files[0]);
      }
    }
  }

  if (foundPath) {
    res.download(foundPath, 'Improx-Agent-Setup.exe');
  } else {
    res.status(404).json({ error: 'Windows Agent installer binary not found on server.' });
  }
});

// Direct Desktop Agent Download Route (macOS .dmg)
app.get(['/download/agent/mac', '/api/download/agent/mac'], (req, res) => {
  const possiblePaths = [
    path.join(updatesDir, 'Improx Monitoring System-1.0.0.dmg'),
    path.join(updatesDir, 'Improx-Agent-Setup.dmg'),
    path.join(__dirname, '../../desktop-agent/release/Improx Monitoring System-1.0.0.dmg')
  ];

  let foundPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (foundPath) {
    res.download(foundPath, 'Improx-Agent-Setup.dmg');
  } else {
    res.status(404).json({ error: 'macOS Agent installer binary (.dmg) not found on server.' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Improx Monitoring System API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);

// Serve Built Frontend React Web App (SPA Fallback)
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/downloads') ||
      req.path.startsWith('/updates') ||
      req.path.startsWith('/download')
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Initialize WebSockets
socketService.initialize(server, config.corsOrigin);

import { purgeOldBackups } from './scripts/purgeOldBackups';

// Start server
server.listen(config.port, async () => {
  console.log('====================================================');
  console.log('🚀 IMPROX MONITORING SYSTEM BACKEND ACTIVE');
  console.log('📡 Server listening on Port: ' + config.port);
  console.log('🌐 Environment: ' + config.nodeEnv);
  console.log('💾 Uploads Directory: ' + config.uploadDir);
  console.log('====================================================');

  await seedInitialAdmin();
  startHeartbeatSupervisor();

  // Run 60-day backup archival purge on startup & every 24 hours
  purgeOldBackups();
  setInterval(purgeOldBackups, 24 * 60 * 60 * 1000);
});

export { app, server };