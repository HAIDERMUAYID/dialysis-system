# إصلاح مشكلة الاتصال مع Supabase

## المشكلة
```
Error: P1001: Can't reach database server at `db.xxxxx.supabase.co:5432`
```

## الحل

### المشكلة الشائعة: استخدام المنفذ الخاطئ

Supabase يوفر منفذين:
- **5432**: للاتصال المباشر (يحتاج SSL ويمكن أن يكون محظوراً)
- **6543**: للـ Connection Pooling (موصى به - يعمل دائماً)

### الحل: استخدم المنفذ 6543

#### الخطوة 1: افتح `prisma/.env`

```bash
nano prisma/.env
```

#### الخطوة 2: تأكد من أن `DATABASE_URL` يستخدم المنفذ 6543

**الصحيح:**
```env
DATABASE_URL="postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:6543/postgres"
```

**الخاطئ:**
```env
DATABASE_URL="postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres"
```

### الحصول على Connection String الصحيح من Supabase

1. **اذهب إلى Supabase Dashboard:**
   - https://supabase.com/dashboard

2. **اختر مشروعك**

3. **Settings → Database**

4. **Connection string → URI (Connection Pooling)**
   - ⚠️ **مهم جداً**: اختر **Connection Pooling** وليس **Direct connection**
   - **Connection Pooling** يستخدم `pooler.supabase.com`
   - **Direct connection** يستخدم `db.xxxxx.supabase.co` (قد لا يعمل)

5. **انسخ الرابط** - سيحتوي على:
   - `pooler.supabase.com` (وليس `db.xxxxx.supabase.co`)
   - `:6543` في النهاية

6. **استبدل `[YOUR-PASSWORD]`** بكلمة المرور التي اخترتها عند إنشاء المشروع

**مثال على الرابط الصحيح:**
```
postgresql://postgres.qgxlgnllviqrewmczyqj:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**ملاحظة:** إذا كان الرابط يحتوي على `db.xxxxx.supabase.co`، فأنت تستخدم Direct connection. استخدم Connection Pooling بدلاً منه.

### مثال كامل

```env
DATABASE_URL="postgresql://postgres.qgxlgnllviqrewmczyqj:your_password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

**ملاحظات:**
- استخدم `pooler.supabase.com` وليس `db.xxxxx.supabase.co`
- استخدم المنفذ `6543`
- تأكد من وجود علامات الاقتباس

### إذا استمرت المشكلة

#### 1. التحقق من كلمة المرور

- تأكد من أنك استبدلت `[YOUR-PASSWORD]` بكلمة المرور الصحيحة
- يمكنك إعادة تعيين كلمة المرور من Supabase Dashboard → Settings → Database → Reset database password

#### 2. التحقق من Firewall

- تأكد من أن Supabase يسمح بالاتصالات من IP الخاص بك
- في Supabase Dashboard → Settings → Database → Connection Pooling
- تأكد من أن "Allow connections from anywhere" مفعّل

#### 3. استخدام Connection String من Supabase مباشرة

- في Supabase Dashboard → Settings → Database
- Connection string → URI (Connection Pooling)
- انسخ الرابط كاملاً واستبدل `[YOUR-PASSWORD]` فقط

### بعد إصلاح `DATABASE_URL`

```bash
# اختبار الاتصال
npx prisma db push
```

إذا نجح، ستظهر رسالة:
```
✔ Your database is now in sync with your Prisma schema.
```

### الخطوة التالية

بعد نجاح الاتصال:

```bash
# إنشاء الجداول
npx prisma db push

# أو إنشاء migrations
npm run prisma:migrate

# عرض البيانات
npm run prisma:studio
```

## ملخص

✅ استخدم **Connection Pooling** (المنفذ 6543)  
✅ استخدم `pooler.supabase.com` في الرابط  
✅ استبدل `[YOUR-PASSWORD]` بكلمة المرور الصحيحة  
✅ تأكد من وجود علامات الاقتباس حول `DATABASE_URL`
