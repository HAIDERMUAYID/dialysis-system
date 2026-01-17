# كيفية إضافة Indexes لتحسين الأداء

## المشكلة
الأمر `npx prisma migrate dev` يبقى معلقاً ولا يكمل.

## الحلول المتاحة

### الحل 1: استخدام `prisma db push` (الأسرع والأسهل)
```bash
npx prisma db push
```
هذا الأمر يطبق التغييرات مباشرة على قاعدة البيانات بدون إنشاء migration files.

### الحل 2: إضافة Indexes يدوياً في Supabase
1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. انسخ محتوى ملف `ADD_INDEXES_MANUAL.sql`
4. الصق في SQL Editor
5. اضغط Run

### الحل 3: استخدام Migration يدوياً
إذا أردت استخدام migrations:
```bash
# إنشاء migration فقط بدون تطبيقه
npx prisma migrate dev --create-only --name add_performance_indexes_v2

# ثم تطبيق migration
npx prisma migrate deploy
```

## ⚠️ ملاحظة مهمة
إذا كان الأمر `prisma migrate dev` يبقى معلقاً، فالحل الأفضل هو:
1. استخدام `prisma db push` مباشرة
2. أو إضافة Indexes يدوياً في Supabase SQL Editor

## بعد إضافة Indexes
1. أعد تشغيل الخادم:
   ```bash
   npm run server
   ```
2. جرّب النظام - يجب أن تلاحظ تحسناً كبيراً في الأداء
