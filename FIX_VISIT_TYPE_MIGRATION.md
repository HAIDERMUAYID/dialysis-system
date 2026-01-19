# 🔧 إصلاح مشكلة visit_type Column

## المشكلة
عمود `visit_type` غير موجود في قاعدة البيانات، مما يسبب أخطاء Prisma.

## الحل

### 1. إضافة Migration
تم إنشاء migration في: `prisma/migrations/add_visit_type/migration.sql`

```sql
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "visit_type" VARCHAR(50) DEFAULT 'normal';
```

### 2. تطبيق Migration على Render

**الخيار 1: تلقائي (مفضل)**
- Render سيطبق Migration تلقائياً عند النشر
- الأمر في build command: `npx prisma migrate deploy`

**الخيار 2: يدوي**
1. افتح Render Dashboard
2. اذهب إلى Database
3. افتح PostgreSQL Console
4. نفذ:
```sql
ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "visit_type" VARCHAR(50) DEFAULT 'normal';
```

### 3. إصلاحات الكود
- ✅ تم إضافة error handling في `server/routes/visits.js`
- ✅ تم إصلاح `server/routes/attachments.js` (إزالة department filter)
- ✅ الكود الآن يتعامل مع حالة عدم وجود العمود بشكل مؤقت

---

## بعد تطبيق Migration

بعد تطبيق Migration، يجب أن يعمل النظام بشكل كامل:
- ✅ إنشاء "زيارة من خلال الطبيب"
- ✅ جلب بيانات الزيارة
- ✅ اختيار التحاليل والأدوية

---

## ملاحظة

إذا استمرت المشكلة بعد تطبيق Migration:
1. تحقق من أن Migration تم تطبيقه: `SELECT column_name FROM information_schema.columns WHERE table_name = 'visits' AND column_name = 'visit_type';`
2. أعد تشغيل الخادم
3. تحقق من السجلات
