# 🔧 Build Command الصحيح لـ Render

## ✅ Build Command المحدث

انسخ هذا Build Command في Render Settings:

```bash
npm install && cd client && npm install && cd .. && npm run build && npx prisma generate && npx prisma migrate deploy
```

---

## 📝 شرح كل جزء

```bash
npm install                    # 1. تثبيت Backend dependencies
cd client && npm install       # 2. تثبيت Frontend dependencies
cd ..                         # 3. العودة للمجلد الرئيسي
npm run build                 # 4. بناء Frontend (React)
npx prisma generate           # 5. توليد Prisma Client
npx prisma migrate deploy     # 6. تشغيل migrations (إنشاء الجداول)
```

---

## 🔧 كيفية التطبيق

### في Render Dashboard:

1. اضغط على خدمة **`hospital-api`**
2. اضغط **"Settings"**
3. ابحث عن **"Build Command"**
4. الصق Build Command أعلاه
5. اضغط **"Save Changes"**
6. اضغط **"Manual Deploy"** → **"Deploy latest commit"**

---

## ✅ بعد التحديث

Build Command سيقوم بـ:
- ✅ تثبيت جميع dependencies
- ✅ بناء Frontend
- ✅ توليد Prisma Client
- ✅ إنشاء جميع الجداول

---

## 🎯 النتيجة المتوقعة

بعد إعادة النشر، يجب أن ترى:
```
==> Build successful 🎉
==> Deploying...
==> Your service is live 🎉
```

---

**انسخ Build Command أعلاه والصقه في Render Settings! 🚀**
