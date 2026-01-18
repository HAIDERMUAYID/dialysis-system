# ✅ قائمة التحقق قبل النشر

## 📋 قبل النشر - تحقق من:

### 1. إعدادات المشروع ✅
- [ ] `.env` موجود ومحدث
- [ ] `DATABASE_URL` صحيح
- [ ] `JWT_SECRET` قوي وآمن
- [ ] `CLIENT_URL` محدث

### 2. قاعدة البيانات ✅
- [ ] قاعدة البيانات جاهزة (Supabase/PostgreSQL)
- [ ] Migrations محدثة
- [ ] Prisma Client محدث (`npx prisma generate`)

### 3. Build ✅
- [ ] Frontend يبني بنجاح (`npm run build` في `client/`)
- [ ] لا توجد أخطاء في Build
- [ ] ملفات `client/build` موجودة

### 4. الأمان ✅
- [ ] كلمات المرور الافتراضية تم تغييرها
- [ ] `JWT_SECRET` قوي
- [ ] Environment Variables آمنة
- [ ] `.env` في `.gitignore`

### 5. الاختبار ✅
- [ ] النظام يعمل محلياً
- [ ] جميع الوظائف تعمل
- [ ] لا توجد أخطاء في Console

---

## 🚀 خطوات النشر السريعة

### على Render.com:

1. ✅ إنشاء PostgreSQL Database
2. ✅ إنشاء Web Service للـ Backend
3. ✅ إنشاء Static Site للـ Frontend
4. ✅ إضافة Environment Variables
5. ✅ تشغيل Migrations

---

## 🔍 بعد النشر - تحقق من:

- [ ] Backend يعمل: `https://your-api.onrender.com/api/health`
- [ ] Frontend يعمل: `https://your-frontend.onrender.com`
- [ ] تسجيل الدخول يعمل
- [ ] قاعدة البيانات متصلة
- [ ] جميع الوظائف تعمل

---

## 📝 Environment Variables المطلوبة

### Backend:
```
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://...
JWT_SECRET=your-strong-secret
CLIENT_URL=https://your-frontend.onrender.com
```

### Frontend:
```
REACT_APP_API_URL=https://your-api.onrender.com
```

---

## 🆘 إذا واجهت مشاكل

1. راجع Build Logs
2. راجع Runtime Logs
3. تحقق من Environment Variables
4. تأكد من تحديث قاعدة البيانات
