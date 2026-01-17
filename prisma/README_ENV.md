# إعداد prisma/.env

## المشكلة
Prisma يبحث عن `DATABASE_URL` في ملف `prisma/.env` وليس في `.env` في الجذر.

## الحل

### الخطوة 1: افتح ملف `prisma/.env`

```bash
nano prisma/.env
```

أو باستخدام VS Code:
```bash
code prisma/.env
```

### الخطوة 2: أضف `DATABASE_URL`

#### الخيار 1: Supabase (موصى به)

```env
DATABASE_URL="postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres"
```

**للحصول على Connection String من Supabase:**
1. اذهب إلى https://supabase.com
2. أنشئ حساب ومشروع جديد
3. Settings → Database → Connection string → URI
4. انسخ الرابط واستبدل `[YOUR-PASSWORD]` بكلمة المرور

#### الخيار 2: PostgreSQL محلي

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hospital_db"
```

**تأكد من:**
- PostgreSQL مثبت ويعمل
- قاعدة البيانات `hospital_db` موجودة
- المستخدم `postgres` موجود

### الخطوة 3: تشغيل Prisma

```bash
# إنشاء الجداول مباشرة (للاختبار)
npx prisma db push

# أو إنشاء migrations (للإنتاج)
npm run prisma:migrate
```

## مثال كامل لملف prisma/.env

```env
# Supabase Example
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:MyPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

## ملاحظات

- تأكد من وضع `DATABASE_URL` بين علامات اقتباس
- لا تشارك ملف `.env` أبداً (موجود في .gitignore)
- للاختبار السريع، يمكنك استخدام PostgreSQL محلي
