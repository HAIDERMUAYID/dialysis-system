# face-api model weights (D-IRS)

These files are **not committed** to git. They are copied from `@vladmandic/face-api` on `npm start` / `npm run build`:

```bash
node scripts/copy-face-models.js
```

Required nets: SSD MobileNet v1, 68 landmarks, face recognition (~12 MB total).

After the first successful load, the service worker caches them for offline use.
