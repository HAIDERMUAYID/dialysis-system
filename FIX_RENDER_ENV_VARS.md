# 🔧 إصلاح Environment Variables في Render

## ⚠️ المشكلة المكتشفة

في صورة Render Dashboard، أرى أن `CLIENT_URL` في Backend مضبوط بشكل خاطئ:

**❌ الخطأ الحالي:**
```
CLIENT_URL=https://hospital-frontend.onrender.com
```

**✅ يجب أن يكون:**
```
CLIENT_URL=https://hospital-frontend-wrxu.onrender.com
```

---

## ✅ الخطوات المطلوبة

### 1. إصلاح Backend Environment Variables

في صفحة `hospital-api` → **Environment**:

1. **عدّل `CLIENT_URL`**:
   - اضغط على حقل `CLIENT_URL`
   - غيّر القيمة إلى:
     ```
     https://hospital-frontend-wrxu.onrender.com
     ```
   - ⚠️ **مهم**: تأكد من أن URL صحيح تماماً!

2. **تحقق من باقي المتغيرات**:
   - ✅ `DATABASE_URL` - موجود وصحيح
   - ✅ `NODE_ENV` = `production` - صحيح
   - ✅ `PORT` = `5001` - صحيح

3. **اضغط "Save, rebuild, and deploy"**

---

### 2. إعداد Frontend Environment Variables

في صفحة `hospital-frontend` → **Environment**:

1. **أضف `REACT_APP_API_URL`**:
   - اضغط "+ Add"
   - **KEY**: `REACT_APP_API_URL`
   - **VALUE**: `https://hospital-api-7v73.onrender.com`
   - ⚠️ **مهم**: يجب أن يبدأ بـ `https://`!

2. **اضغط "Save, rebuild, and deploy"**

---

## 📋 Checklist كامل

### Backend (`hospital-api`):
- [ ] `CLIENT_URL` = `https://hospital-frontend-wrxu.onrender.com`
- [ ] `DATABASE_URL` = موجود وصحيح
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `5001`
- [ ] تم الضغط على "Save, rebuild, and deploy"

### Frontend (`hospital-frontend`):
- [ ] `REACT_APP_API_URL` = `https://hospital-api-7v73.onrender.com`
- [ ] تم الضغط على "Save, rebuild, and deploy"

---

## 🔍 التحقق من الإصلاح

بعد إعادة النشر (انتظر 2-3 دقائق):

### 1. تحقق من Backend:
افتح في المتصفح:
```
https://hospital-api-7v73.onrender.com/api/health
```
يجب أن ترى:
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### 2. تحقق من Frontend:
1. افتح: `https://hospital-frontend-wrxu.onrender.com`
2. افتح Developer Tools (F12) → **Console**
3. يجب أن ترى:
   ```
   API Base URL: https://hospital-api-7v73.onrender.com
   ```

### 3. جرب تسجيل الدخول:
- **Username**: `admin`
- **Password**: `admin123`

---

## 🐛 إذا لم يعمل بعد

### تحقق من Logs:

1. **Backend Logs**:
   - Render → `hospital-api` → **Logs**
   - ابحث عن أخطاء CORS أو database

2. **Frontend Logs**:
   - Render → `hospital-frontend` → **Logs**
   - ابحث عن أخطاء build أو `REACT_APP_API_URL`

### تحقق من URLs:

- **Frontend URL**: `https://hospital-frontend-wrxu.onrender.com`
- **Backend URL**: `https://hospital-api-7v73.onrender.com`

⚠️ **مهم**: تأكد من أن URLs صحيحة تماماً في Environment Variables!

---

## ✅ بعد الإصلاح

بعد تطبيق هذه التغييرات:
1. ✅ CORS يعمل بشكل صحيح
2. ✅ Frontend يتصل بالـ Backend
3. ✅ تسجيل الدخول يعمل

---

**ملاحظة**: بعد تغيير Environment Variables، يجب إعادة النشر (Rebuild and Deploy) لكلا الخدمتين!
