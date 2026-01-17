# 🔧 إصلاح مشكلة الجداول المفقودة

## ⚠️ المشكلة

من Logs:
```
The table `public.roles` does not exist in the current database.
The table `public.users` does not exist in the current database.
```

لكن الكود يقول:
```
Database tables exist, migrations already applied
```

**المشكلة**: فحص وجود الجداول كان خاطئاً، والجداول غير موجودة فعلياً!

---

## ✅ الحل الفوري

### الخطوة 1: تشغيل Migrations يدوياً

1. اذهب إلى Render Dashboard
2. افتح خدمة `hospital-api`
3. اضغط **"Shell"** (في القائمة الجانبية)
4. شغّل الأوامر التالية **بالتسلسل**:

```bash
npx prisma generate
```

انتظر حتى ينتهي، ثم:

```bash
npx prisma migrate deploy
```

انتظر حتى ينتهي. يجب أن ترى:
```
Applied migration: 20240101000000_init
```

---

### الخطوة 2: التحقق من الجداول

في نفس Shell، شغّل:

```bash
npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

أو استخدم:

```bash
npx prisma studio
```

(هذا سيفتح Prisma Studio في المتصفح)

---

### الخطوة 3: إعادة تشغيل الخدمة

1. اذهب إلى Render Dashboard → `hospital-api`
2. اضغط **"Manual Deploy"** → **"Deploy latest commit"**
3. انتظر حتى ينتهي البناء

---

## 🔍 التحقق من الإصلاح

بعد إعادة النشر، تحقق من Logs:

1. Render Dashboard → `hospital-api` → **"Logs"**
2. يجب أن ترى:
   ```
   Connected to database via Prisma
   Database tables exist, migrations already applied
   ```
   **بدون** أخطاء `does not exist`!

3. جرب تسجيل الدخول:
   - Username: `admin`
   - Password: `admin123`
   - يجب أن يعمل بدون أخطاء!

---

## 🐛 إذا لم يعمل

### المشكلة: "No migrations found"

**الحل**:
1. في Shell:
   ```bash
   npx prisma migrate dev --name init
   ```
2. ثم:
   ```bash
   npx prisma migrate deploy
   ```

---

### المشكلة: "Migration failed"

**الحل**:
1. تحقق من `prisma/schema.prisma`
2. تحقق من `prisma/migrations/` folder
3. إذا لم توجد migrations:
   ```bash
   npx prisma migrate dev --name init --create-only
   npx prisma migrate deploy
   ```

---

### المشكلة: "Connection refused"

**الحل**:
1. تحقق من `DATABASE_URL` في Environment Variables
2. يجب أن يكون Internal URL (ليس External)
3. يجب أن يبدأ بـ `postgresql://`

---

## 📋 Checklist

- [ ] تم تشغيل `npx prisma generate` بنجاح
- [ ] تم تشغيل `npx prisma migrate deploy` بنجاح
- [ ] Logs تظهر `Database tables exist` بدون أخطاء
- [ ] تسجيل الدخول يعمل بدون أخطاء
- [ ] Health endpoint يظهر `"dbInitialized": true`

---

## ✅ بعد الإصلاح

بعد تطبيق هذه الخطوات:
1. ✅ الجداول موجودة في قاعدة البيانات
2. ✅ تسجيل الدخول يعمل
3. ✅ النظام جاهز للاستخدام

---

**ملاحظة مهمة**: بعد تشغيل migrations، يجب أن ترى الجداول التالية:
- `roles`
- `users`
- `patients`
- `visits`
- `lab_results`
- `pharmacy_prescriptions`
- `diagnoses`
- وغيرها...

إذا لم تظهر، migrations لم تعمل بشكل صحيح!
