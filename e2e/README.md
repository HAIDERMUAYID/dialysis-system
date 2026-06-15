# D-IRS — اختبارات E2E (Playwright)

## المتطلبات

- Node.js + npm
- قاعدة بيانات مهيّأة مع seed (`npm run prisma:seed`)
- حساب افتراضي: `admin` / `123456`

## التشغيل المحلي

```bash
# من جذر المشروع — يشغّل الخادم (5001) والواجهة (3000) تلقائياً إن لم يكونا يعملان
npm run test:e2e

# واجهة تفاعلية
npm run test:e2e:ui
```

## متغيرات اختيارية

| المتغير | الافتراضي |
|---------|-----------|
| `E2E_BASE_URL` | `http://127.0.0.1:3000` |
| `E2E_API_URL` | `http://127.0.0.1:5001` |
| `E2E_USER` | `admin` |
| `E2E_PASS` | `123456` |

## الملفات

```
e2e/
├── dialysis/
│   ├── auth.spec.ts       — دخول UI
│   ├── navigation.spec.ts — تحميل الصفحات
│   └── crud.spec.ts       — مريض + جلسة + حذف
└── helpers/
    ├── api.ts             — مساعد API
    ├── env.ts
    └── ui.ts
```

## CI

Workflow: `.github/workflows/e2e-dialysis.yml` — يتطلب PostgreSQL و `DATABASE_URL`.
