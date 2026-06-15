/**
 * Generates maskable + standard PWA icons for D-IRS from ministry logo.
 * Run: node scripts/generate-pwa-icons.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public/images/ministry-logo.png');
const OUT = path.join(ROOT, 'public/images');
const BRAND = { r: 21, g: 124, b: 103, alpha: 1 };

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.warn('[generate-pwa-icons] sharp not installed — skip (run: npm i -D sharp)');
    process.exit(0);
  }

  if (!fs.existsSync(SRC)) {
    console.warn('[generate-pwa-icons] source logo missing:', SRC);
    process.exit(0);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const specs = [
    { name: 'pwa-icon-192.png', size: 192, maskable: false },
    { name: 'pwa-icon-512.png', size: 512, maskable: false },
    { name: 'pwa-icon-192-maskable.png', size: 192, maskable: true },
    { name: 'pwa-icon-512-maskable.png', size: 512, maskable: true },
  ];

  for (const { name, size, maskable } of specs) {
    const logoFrac = maskable ? 0.48 : 0.68;
    const logoSize = Math.round(size * logoFrac);
    const logoBuf = await sharp(SRC)
      .resize(logoSize, logoSize, { fit: 'contain', background: { ...BRAND, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BRAND,
      },
    })
      .composite([{ input: logoBuf, gravity: 'center' }])
      .png()
      .toFile(path.join(OUT, name));

    console.log('[generate-pwa-icons]', name);
  }
}

main().catch((err) => {
  console.error('[generate-pwa-icons]', err);
  process.exit(1);
});
