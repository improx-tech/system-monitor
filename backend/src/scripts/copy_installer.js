const fs = require('fs');
const path = require('path');

const srcFile = path.resolve(__dirname, '../../../desktop-agent/release/Improx Monitoring System Setup 1.0.0.exe');
const downloadsDest = path.resolve(__dirname, '../../downloads/Improx Monitoring System Setup 1.0.0.exe');
const updatesDest = path.resolve(__dirname, '../../updates/Improx Monitoring System Setup 1.0.0.exe');

fs.mkdirSync(path.dirname(downloadsDest), { recursive: true });
fs.mkdirSync(path.dirname(updatesDest), { recursive: true });

if (fs.existsSync(srcFile)) {
  fs.copyFileSync(srcFile, downloadsDest);
  fs.copyFileSync(srcFile, updatesDest);
  console.log('SUCCESS: Copied updated Windows agent installer exe to backend/downloads/ and backend/updates/');
} else {
  console.error('Source file not found:', srcFile);
}
