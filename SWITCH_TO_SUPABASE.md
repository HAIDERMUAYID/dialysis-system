# التبديل من SQLite إلى Supabase

## المشكلة
النظام ما زال يستخدم SQLite المحلي (`database.sqlite`) بدلاً من Supabase، لذلك تظهر البيانات القديمة.

## الحل

### الخطوة 1: إنشاء/تحديث `.env` في الجذر

النظام يقرأ من `.env` في الجذر (ليس فقط `prisma/.env`).

أنشئ أو حدّث ملف `.env` في الجذر:

```env
# Server Configuration
PORT=5001
NODE_ENV=development

# Client URL
CLIENT_URL=http://localhost:3000

# Database Configuration - استخدم Prisma/Supabase
DB_TYPE=prisma

# ملاحظة: DATABASE_URL موجود في prisma/.env
# النظام سيقرأه من هناك أيضاً

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

**المهم:** `DB_TYPE=prisma` - هذا يخبر النظام باستخدام Prisma/Supabase.

### الخطوة 2: التحقق من `prisma/.env`

تأكد من أن `prisma/.env` يحتوي على `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
```

### الخطوة 3: إعادة تشغيل الخادم

```bash
# إيقاف الخادم (Ctrl+C)
# ثم إعادة التشغيل:
npm run server
```

أو:

```bash
npm run dev
```

### الخطوة 4: التحقق من الاتصال

بعد إعادة التشغيل، يجب أن ترى في Terminal:

```
Connected to database via Prisma
```

وليس:

```
Connected to SQLite database
```

## التحقق من أن النظام يستخدم Supabase

### 1. من Terminal (عند بدء الخادم):

يجب أن ترى:
```
Connected to database via Prisma
```

وليس:
```
Connected to SQLite database
```

### 2. من Supabase Dashboard:

- اذهب إلى **Table Editor**
- أضف بيانات جديدة من التطبيق
- يجب أن تظهر في Supabase فوراً

### 3. من Prisma Studio:

```bash
npm run prisma:studio
```

- افتح http://localhost:5555
- يجب أن ترى البيانات من Supabase

## نقل البيانات من SQLite إلى Supabase (اختياري)

إذا أردت نقل البيانات القديمة من SQLite إلى Supabase:

### الطريقة 1: يدوياً

1. افتح `database.sqlite` باستخدام أداة SQLite
2. انسخ البيانات من كل جدول
3. أضفها يدوياً في Supabase Dashboard → Table Editor

### الطريقة 2: استخدام SQL Script

يمكنك كتابة script لنقل البيانات، لكن هذا معقد.

### الطريقة 3: البدء من جديد (موصى به)

إذا كانت البيانات القديمة غير مهمة:
- ابدأ باستخدام Supabase من الصفر
- البيانات الجديدة ستُحفظ في Supabase

## استكشاف الأخطاء

### إذا ظهر "Connected to SQLite database":

1. تحقق من `.env` في الجذر
2. تأكد من `DB_TYPE=prisma`
3. أعد تشغيل الخادم

### إذا ظهر خطأ في الاتصال:

1. تحقق من `prisma/.env` و`DATABASE_URL`
2. تأكد من استخدام Connection Pooling (`pooler.supabase.com:6543`)
3. تحقق من كلمة المرور

### إذا لم تظهر البيانات:

1. تأكد من أن الجداول موجودة في Supabase
2. تحقق من أن `DB_TYPE=prisma` في `.env`
3. أعد تشغيل الخادم

## ملخص الخطوات

1. ✅ إنشاء/تحديث `.env` في الجذر مع `DB_TYPE=prisma`
2. ✅ التحقق من `prisma/.env` و`DATABASE_URL`
3. ✅ إعادة تشغيل الخادم
4. ✅ التحقق من أن النظام متصل بـ Supabase
5. ✅ اختبار النظام - البيانات الجديدة يجب أن تظهر في Supabase

## بعد التبديل

بعد التبديل بنجاح:
- ✅ جميع البيانات الجديدة ستُحفظ في Supabase
- ✅ يمكنك الوصول للبيانات من أي مكان
- ✅ البيانات محفوظة في السحابة (Cloud)
- ✅ نسخ احتياطي تلقائي من Supabase
