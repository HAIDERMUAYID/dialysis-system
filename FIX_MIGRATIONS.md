# 🔧 إصلاح مشكلة Migrations

## المشكلة
```
The table `public.roles` does not exist in the current database.
```

## الحل السريع

### على Render.com:

1. **في خدمة `hospital-api`**:
   - اضغط **"Shell"** (في القائمة الجانبية)
   
2. **شغّل الأوامر:**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **إعادة التشغيل:**
   - اضغط **"Manual Deploy"** → **"Deploy latest commit"**

---

## الحل الدائم (تحديث Build Command)

### تحديث Build Command في Render:

1. في Render Dashboard، اضغط على خدمة `hospital-api`
2. اضغط **"Settings"**
3. في **"Build Command"**، غيّره إلى:
   ```bash
   npm install && npm run build && npx prisma generate && npx prisma migrate deploy
   ```
4. اضغط **"Save Changes"**
5. اضغط **"Manual Deploy"** → **"Deploy latest commit"**

---

## التحقق من الحل

بعد تطبيق الحل، تحقق من:

1. افتح: `https://your-api.onrender.com/api/health`
2. يجب أن ترى:
   ```json
   {
     "status": "OK",
     "message": "Server is running",
     "dbInitialized": true
   }
   ```

---

## ملاحظات

- ✅ تحديث `db-prisma.js` ليشغل migrations تلقائياً
- ✅ تحديث Build Command ليشمل migrations
- ✅ الخطوات أعلاه تحل المشكلة

---

**بعد تطبيق الحل، النظام سيعمل بشكل صحيح! ✅**
