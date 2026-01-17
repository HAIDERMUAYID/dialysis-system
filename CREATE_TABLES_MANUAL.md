# إنشاء الجداول يدوياً من Supabase Dashboard

## المشكلة
`npx prisma migrate dev` و `npx prisma db push` لا يعملان مع Connection Pooling.

## الحل: إنشاء الجداول يدوياً

### الطريقة 1: استخدام SQL Editor في Supabase

1. **اذهب إلى Supabase Dashboard:**
   - https://supabase.com/dashboard
   - اختر مشروعك

2. **افتح SQL Editor:**
   - من القائمة الجانبية، اختر **SQL Editor**

3. **انسخ محتوى الملف:**
   - افتح `CREATE_TABLES_SQL.sql`
   - انسخ جميع محتوياته

4. **الصق في SQL Editor:**
   - الصق الكود في SQL Editor
   - اضغط **Run** أو `Ctrl+Enter`

5. **التحقق:**
   - اذهب إلى **Table Editor**
   - يجب أن ترى جميع الجداول

### الطريقة 2: استخدام Direct Connection

1. **احصل على Direct Connection String:**
   - Supabase Dashboard → Settings → Database
   - Connection string → **URI (Direct connection)**
   - انسخ الرابط (سيحتوي على `:5432`)

2. **حدّث `prisma/.env`:**
   ```env
   DATABASE_URL="postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres"
   ```
   ⚠️ استخدم Direct connection وليس Pooling

3. **شغّل Migrate:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **بعد اكتمال Migrate، ارجع إلى Pooling:**
   - عدّل `prisma/.env` لاستخدام Pooling مرة أخرى
   - (Pooling أفضل للأداء)

### الطريقة 3: استخدام db push مع Direct Connection

1. **استخدم Direct Connection مؤقتاً:**
   - عدّل `prisma/.env` لاستخدام Direct connection

2. **شغّل:**
   ```bash
   npx prisma db push --accept-data-loss
   ```

3. **ارجع إلى Pooling:**
   - عدّل `prisma/.env` لاستخدام Pooling

## الموصى به: الطريقة 1 (SQL Editor)

هذه الطريقة الأسهل والأسرع:
1. ✅ لا تحتاج تغيير `DATABASE_URL`
2. ✅ تعمل مباشرة من Supabase Dashboard
3. ✅ يمكنك رؤية النتائج فوراً

## بعد إنشاء الجداول

### 1. التحقق من الجداول:
- اذهب إلى **Table Editor**
- يجب أن ترى 19 جدول

### 2. إضافة البيانات الافتراضية:

يمكنك إضافة البيانات الافتراضية من `server/database/db-prisma.js` أو يدوياً:

```sql
-- إضافة الأدوار
INSERT INTO roles (name, display_name, is_system_role) VALUES
('admin', 'مدير النظام', 1),
('inquiry', 'موظف الاستعلامات', 1),
('lab', 'موظف التحاليل', 1),
('lab_manager', 'مدير المختبر', 1),
('pharmacist', 'الصيدلي', 1),
('pharmacy_manager', 'مدير الصيدلية', 1),
('doctor', 'الطبيب', 1);
```

### 3. توليد Prisma Client:

```bash
npm run prisma:generate
```

### 4. التحقق من Prisma Studio:

```bash
npm run prisma:studio
```

## ملاحظات

- **Direct Connection** (`:5432`) يدعم Migrations
- **Connection Pooling** (`:6543`) أفضل للأداء لكن قد لا يدعم Migrations
- يمكنك استخدام Direct Connection لإنشاء الجداول، ثم العودة لـ Pooling

## استكشاف الأخطاء

### إذا ظهر خطأ "relation already exists":
- الجداول موجودة بالفعل
- تحقق من Table Editor

### إذا ظهر خطأ في Foreign Key:
- تأكد من إنشاء الجداول بالترتيب الصحيح
- الجداول الأساسية أولاً (roles, users) ثم الجداول التي تعتمد عليها

### إذا لم تظهر الجداول:
- تأكد من تشغيل SQL في Schema الصحيح (`public`)
- تحقق من Table Editor → schema public
