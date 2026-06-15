/**
 * Copies face-api weight files used by D-IRS (3 nets) into public/ for offline PWA.
 * Run automatically via prestart / prebuild.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules/@vladmandic/face-api/model');
const DEST = path.join(ROOT, 'public/models/face-api');

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin',
];

if (!fs.existsSync(SRC)) {
  console.warn('[copy-face-models] @vladmandic/face-api not installed — skipping');
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });

for (const name of FILES) {
  fs.copyFileSync(path.join(SRC, name), path.join(DEST, name));
}

console.log(`[copy-face-models] ${FILES.length} files → public/models/face-api`);
