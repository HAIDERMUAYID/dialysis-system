# إصلاح مشكلة DATABASE_URL في Prisma

## المشكلة
Prisma لا يجد `DATABASE_URL` لأنه يبحث في `prisma/.env` وليس في `.env` في الجذر.

## الحل السريع

### الخطوة 1: افتح ملف `prisma/.env`

```bash
nano prisma/.env
```

أو باستخدام VS Code:
```bash
code prisma/.env
```

### الخطوة 2: أضف `DATABASE_URL`

#### إذا كان لديك DATABASE_URL في `.env` في الجذر:
انسخ السطر الذي يحتوي على `DATABASE_URL` والصقه في `prisma/.env`

#### إذا لم يكن لديك DATABASE_URL:

**للاختبار مع PostgreSQL محلي:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hospital_db"
```

**للاستخدام مع Supabase:**
```env
DATABASE_URL="postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres"
```

### الخطوة 3: احفظ الملف

في nano: اضغط `Ctrl+X` ثم `Y` ثم `Enter`

### الخطوة 4: شغّل Prisma

```bash
npx prisma db push
```

## مثال كامل لملف `prisma/.env`

```env
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:MyPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

## ملاحظات مهمة

1. **Prisma يقرأ من `prisma/.env` أولاً** - هذا هو السلوك الافتراضي
2. **تأكد من وجود علامات الاقتباس** حول `DATABASE_URL`
3. **لا تضع مسافات** قبل أو بعد `=`
4. **استبدل القيم** بالبيانات الحقيقية من Supabase أو PostgreSQL

## استكشاف الأخطاء

### إذا ظهر نفس الخطأ بعد إضافة DATABASE_URL:

1. تأكد من حفظ الملف (`Ctrl+X` ثم `Y` في nano)
2. تأكد من وجود علامات الاقتباس
3. تأكد من عدم وجود مسافات إضافية
4. جرب إعادة تشغيل الأمر: `npx prisma db push`
