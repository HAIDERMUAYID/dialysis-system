# حل مشكلة Prisma Studio Error

## المشكلة
```
Fatal Error: Unable to process `count` query undefined
```

## الحلول

### الحل 1: إعادة توليد Prisma Client

```bash
# إيقاف Prisma Studio (Ctrl+C)
# ثم:
npm run prisma:generate
```

### الحل 2: إعادة تشغيل Prisma Studio

```bash
# أغلق Prisma Studio
# ثم شغّله مرة أخرى:
npm run prisma:studio
```

### الحل 3: التحقق من الاتصال بقاعدة البيانات

```bash
# اختبار الاتصال
npx prisma db push
```

إذا ظهر خطأ، تحقق من `prisma/.env` و`DATABASE_URL`.

### الحل 4: التحقق من Schema

تأكد من أن `prisma/schema.prisma` صحيح ولا يحتوي على أخطاء:

```bash
# التحقق من Schema
npx prisma validate
```

### الحل 5: إعادة تعيين قاعدة البيانات (⚠️ يحذف البيانات!)

```bash
# ⚠️ تحذير: هذا سيحذف جميع البيانات!
npx prisma migrate reset
```

**استخدم هذا فقط إذا:**
- قاعدة البيانات فارغة
- أو تريد البدء من جديد
- أو البيانات غير مهمة

### الحل 6: استخدام Prisma Studio مع خيارات مختلفة

```bash
# تشغيل Prisma Studio على منفذ مختلف
npx prisma studio --port 5556

# أو مع خيارات إضافية
npx prisma studio --browser none
```

## خطوات الحل الموصى بها (بالترتيب)

### الخطوة 1: إعادة توليد Prisma Client

```bash
npm run prisma:generate
```

### الخطوة 2: التحقق من Schema

```bash
npx prisma validate
```

### الخطوة 3: التحقق من الاتصال

```bash
npx prisma db push
```

### الخطوة 4: إعادة تشغيل Prisma Studio

```bash
npm run prisma:studio
```

## أسباب شائعة للخطأ

1. **Prisma Client غير محدث**: بعد تغيير Schema، يجب تشغيل `prisma generate`
2. **مشكلة في الاتصال**: قاعدة البيانات غير متاحة أو `DATABASE_URL` غير صحيح
3. **Schema غير صحيح**: أخطاء في تعريف Models
4. **مشكلة في الصلاحيات**: المستخدم لا يملك صلاحيات كافية

## التحقق من الحالة

### 1. التحقق من Prisma Client

```bash
# التحقق من أن Prisma Client محدث
ls -la node_modules/@prisma/client
```

### 2. التحقق من الاتصال

```bash
# اختبار الاتصال المباشر
psql "postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
```

### 3. التحقق من Schema

```bash
# التحقق من صحة Schema
npx prisma validate
```

## إذا استمرت المشكلة

1. **تحقق من السجلات:**
   - ابحث عن أخطاء في Terminal
   - تحقق من Supabase Dashboard → Logs

2. **جرب إعادة التعيين:**
   ```bash
   npx prisma migrate reset
   npx prisma db push
   ```

3. **تحقق من الإصدارات:**
   ```bash
   npx prisma --version
   npm list @prisma/client
   ```

4. **تحديث Prisma:**
   ```bash
   npm update @prisma/client prisma
   npm run prisma:generate
   ```

## بدائل Prisma Studio

إذا استمرت المشكلة، يمكنك:

1. **استخدام Supabase Dashboard:**
   - اذهب إلى Supabase Dashboard
   - Table Editor لعرض وتعديل البيانات

2. **استخدام psql:**
   ```bash
   psql "postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
   ```

3. **استخدام أدوات أخرى:**
   - pgAdmin
   - DBeaver
   - TablePlus

## ملخص الحل السريع

```bash
# 1. إعادة توليد Prisma Client
npm run prisma:generate

# 2. التحقق من Schema
npx prisma validate

# 3. التحقق من الاتصال
npx prisma db push

# 4. إعادة تشغيل Prisma Studio
npm run prisma:studio
```

إذا استمرت المشكلة بعد هذه الخطوات، قد تكون المشكلة في قاعدة البيانات نفسها أو في الصلاحيات.
