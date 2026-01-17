# إصلاح مشكلة المصادقة مع PostgreSQL

## المشكلة
```
Error: P1000: Authentication failed against database server at `localhost`
```

## الحلول

### الحل 1: التحقق من بيانات الاعتماد

افتح `prisma/.env` وتحقق من `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hospital_db"
```

**تأكد من:**
- اسم المستخدم: `postgres` (أو اسم المستخدم الصحيح)
- كلمة المرور: `postgres` (أو كلمة المرور الصحيحة)
- اسم قاعدة البيانات: `hospital_db`

### الحل 2: إنشاء قاعدة البيانات والمستخدم

#### الخطوة 1: الدخول إلى PostgreSQL

```bash
# إذا كان PostgreSQL يعمل محلياً
psql postgres

# أو مع اسم مستخدم محدد
psql -U postgres
```

#### الخطوة 2: إنشاء قاعدة البيانات والمستخدم

```sql
-- إنشاء قاعدة البيانات
CREATE DATABASE hospital_db;

-- إنشاء مستخدم (إذا لم يكن موجوداً)
CREATE USER postgres WITH PASSWORD 'postgres';

-- منح الصلاحيات
GRANT ALL PRIVILEGES ON DATABASE hospital_db TO postgres;

-- الخروج
\q
```

### الحل 3: التحقق من أن PostgreSQL يعمل

#### على macOS (مع Homebrew):

```bash
# التحقق من الحالة
brew services list | grep postgresql

# تشغيل PostgreSQL
brew services start postgresql

# إعادة تشغيل PostgreSQL
brew services restart postgresql
```

#### على Linux:

```bash
# التحقق من الحالة
sudo systemctl status postgresql

# تشغيل PostgreSQL
sudo systemctl start postgresql
```

### الحل 4: استخدام Supabase (الأسهل)

بدلاً من إعداد PostgreSQL محلياً، استخدم Supabase:

1. **إنشاء حساب على Supabase:**
   - اذهب إلى https://supabase.com
   - أنشئ حساب جديد (مجاني)
   - أنشئ مشروع جديد

2. **الحصول على Connection String:**
   - Settings → Database → Connection string → URI
   - انسخ الرابط (سيبدو هكذا):
     ```
     postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
     ```

3. **تحديث `prisma/.env`:**
   ```env
   DATABASE_URL="postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres"
   ```

4. **تشغيل Prisma:**
   ```bash
   npx prisma db push
   ```

### الحل 5: إعادة تعيين كلمة مرور PostgreSQL

إذا نسيت كلمة المرور:

#### على macOS:

```bash
# إيقاف PostgreSQL
brew services stop postgresql

# تشغيل PostgreSQL بدون مصادقة (مؤقت)
postgres -D /usr/local/var/postgres

# في terminal آخر:
psql postgres
ALTER USER postgres WITH PASSWORD 'new_password';
\q
```

## اختبار الاتصال

بعد إصلاح المشكلة، اختبر الاتصال:

```bash
# اختبار الاتصال
psql "postgresql://postgres:postgres@localhost:5432/hospital_db"

# إذا نجح، ستظهر رسالة ترحيب
# اكتب \q للخروج
```

## الموصى به

**استخدم Supabase** لأنه:
- ✅ لا يحتاج إعداد محلي
- ✅ مجاني حتى 500MB
- ✅ جاهز للاستخدام فوراً
- ✅ نسخ احتياطي تلقائي
- ✅ واجهة رسومية لإدارة البيانات

## بعد إصلاح المشكلة

```bash
# إنشاء الجداول
npx prisma db push

# أو إنشاء migrations
npm run prisma:migrate

# عرض البيانات
npm run prisma:studio
```
