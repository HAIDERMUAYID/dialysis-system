# إعداد ملف .env

## المشكلة
Prisma يحتاج إلى متغير `DATABASE_URL` في ملف `.env`.

## الحل السريع

### الخطوة 1: إنشاء ملف .env

في الجذر (`/Users/haider.m/Desktop/project/hosptal/`)، أنشئ ملف `.env` وأضف المحتوى التالي:

```env
# Server Configuration
PORT=5001
NODE_ENV=development

# Client URL
CLIENT_URL=http://localhost:3000

# Database Configuration - اختر أحد الخيارات:

# الخيار 1: Supabase (موصى به)
DB_TYPE=prisma
DATABASE_URL="postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres"

# الخيار 2: PostgreSQL محلي
# DB_TYPE=prisma
# DATABASE_URL="postgresql://postgres:password@localhost:5432/hospital_db"

# الخيار 3: SQLite (للاختبار فقط - Prisma لا يدعمه بشكل جيد)
# DB_TYPE=sqlite
# DB_PATH=./database.sqlite

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

### الخطوة 2: الحصول على DATABASE_URL من Supabase

1. اذهب إلى https://supabase.com
2. أنشئ حساب جديد (مجاني)
3. أنشئ مشروع جديد
4. اذهب إلى **Settings** → **Database**
5. انسخ **Connection string** → **URI**
6. استبدل `[YOUR-PASSWORD]` بكلمة المرور
7. الصقها في `.env` كقيمة لـ `DATABASE_URL`

### الخطوة 3: تشغيل Prisma

```bash
# توليد Prisma Client
npm run prisma:generate

# إنشاء الجداول
npm run prisma:migrate
```

## مثال كامل لملف .env مع Supabase

```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
DB_TYPE=prisma
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:MyPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
JWT_SECRET=my-super-secret-key-12345
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
LOG_LEVEL=info
LOG_DIR=./logs
```

## ملاحظات

- تأكد من وضع `DATABASE_URL` بين علامات اقتباس إذا كانت تحتوي على رموز خاصة
- لا تشارك ملف `.env` أبداً (موجود في .gitignore)
- غيّر `JWT_SECRET` إلى قيمة عشوائية قوية
