# 🔧 إصلاح خطأ Build: react-scripts not found

## المشكلة
```
sh: 1: react-scripts: not found
==> Build failed 😞
```

## السبب
`react-scripts` غير موجود لأن dependencies للـ client لم يتم تثبيتها.

---

## ✅ الحل السريع

### تحديث Build Command في Render:

1. في Render Dashboard:
   - اضغط على خدمة **`hospital-api`**
   - اضغط **"Settings"**

2. في **"Build Command"**، غيّره إلى:
   ```bash
   npm install && cd client && npm install && cd .. && npm run build && npx prisma generate && npx prisma migrate deploy
   ```

3. اضغط **"Save Changes"**

4. اضغط **"Manual Deploy"** → **"Deploy latest commit"**

---

## 📝 شرح Build Command

```bash
npm install                    # تثبيت dependencies للـ Backend
cd client && npm install       # تثبيت dependencies للـ Frontend
cd ..                         # العودة للمجلد الرئيسي
npm run build                 # بناء Frontend
npx prisma generate           # توليد Prisma Client
npx prisma migrate deploy     # تشغيل migrations
```

---

## ✅ بعد التحديث

Build Command سيقوم بـ:
1. ✅ تثبيت Backend dependencies
2. ✅ تثبيت Frontend dependencies
3. ✅ بناء Frontend
4. ✅ توليد Prisma Client
5. ✅ تشغيل migrations

---

## 🔍 التحقق

بعد إعادة النشر، يجب أن ترى:
- ✅ "Build successful 🎉"
- ✅ "Deploying..."
- ✅ "Your service is live 🎉"

---

**حدث Build Command الآن وأعد النشر! 🚀**
