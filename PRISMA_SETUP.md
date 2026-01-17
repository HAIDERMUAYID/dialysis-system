# إعداد Prisma و Supabase

## المشكلة الحالية

Prisma يحتاج إلى متغير `DATABASE_URL` في ملف `.env` للاتصال بقاعدة البيانات.

## الحلول

### الحل 1: استخدام Supabase (موصى به)

1. **إنشاء حساب Supabase:**
   - اذهب إلى https://supabase.com
   - أنشئ حساب جديد
   - أنشئ مشروع جديد

2. **الحصول على Connection String:**
   - في Supabase Dashboard: **Settings** → **Database**
   - انسخ **Connection string** → **URI**
   - سيبدو هكذا:
     ```
     postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
     ```
   - استبدل `[YOUR-PASSWORD]` بكلمة المرور التي اخترتها

3. **تحديث ملف `.env`:**
   ```env
   DB_TYPE=prisma
   DATABASE_URL="postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres"
   ```

4. **تشغيل Migrations:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

### الحل 2: استخدام PostgreSQL محلي

1. **تثبيت PostgreSQL:**
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql

   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **إنشاء قاعدة البيانات:**
   ```bash
   # الدخول إلى PostgreSQL
   psql postgres

   # في PostgreSQL shell:
   CREATE DATABASE hospital_db;
   CREATE USER hospital_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE hospital_db TO hospital_user;
   \q
   ```

3. **تحديث ملف `.env`:**
   ```env
   DB_TYPE=prisma
   DATABASE_URL="postgresql://hospital_user:your_password@localhost:5432/hospital_db"
   ```

4. **تشغيل Migrations:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

### الحل 3: الاستمرار مع SQLite (للاختبار فقط)

إذا كنت تريد الاستمرار مع SQLite للاختبار المحلي:

1. **تحديث ملف `.env`:**
   ```env
   DB_TYPE=sqlite
   DB_PATH=./database.sqlite
   ```

2. **ملاحظة:** Prisma لا يدعم SQLite بشكل جيد. استخدم PostgreSQL أو Supabase للإنتاج.

## بعد الإعداد

بعد إعداد `DATABASE_URL`:

```bash
# توليد Prisma Client
npm run prisma:generate

# إنشاء الجداول
npm run prisma:migrate

# عرض البيانات (اختياري)
npm run prisma:studio
```

## استكشاف الأخطاء

### خطأ: "Environment variable not found: DATABASE_URL"
- تأكد من وجود ملف `.env` في الجذر
- تأكد من وجود `DATABASE_URL` في الملف
- تأكد من أن القيمة بين علامات اقتباس إذا كانت تحتوي على رموز خاصة

### خطأ: "Can't reach database server"
- تحقق من صحة `DATABASE_URL`
- تحقق من أن قاعدة البيانات تعمل
- تحقق من إعدادات Firewall

### خطأ: "Authentication failed"
- تحقق من اسم المستخدم وكلمة المرور
- تأكد من أن المستخدم لديه الصلاحيات المطلوبة
