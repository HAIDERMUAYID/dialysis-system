# 🔧 إصلاح مشكلة تسجيل الدخول - خطوات فورية

## ⚠️ المشكلة
تسجيل الدخول لا يعمل - الواجهة تظهر لكن لا يمكن الاتصال بالـ Backend.

---

## ✅ الحل السريع (5 دقائق)

### الخطوة 1: تحقق من Backend URL

افتح Developer Tools (F12) في المتصفح → Console
- يجب أن ترى: `API Base URL: https://hospital-api-7v73.onrender.com`
- إذا رأيت: `API Base URL: http://localhost:5001` ← المشكلة هنا!

---

### الخطوة 2: إعداد Frontend في Render

1. اذهب إلى **Render Dashboard**
2. افتح خدمة **`hospital-frontend`**
3. اضغط **"Environment"** (في القائمة الجانبية)
4. ابحث عن `REACT_APP_API_URL` أو أضفه:
   ```
   REACT_APP_API_URL=https://hospital-api-7v73.onrender.com
   ```
   ⚠️ **مهم جداً**: يجب أن يبدأ بـ `https://` وليس `http://`!
5. اضغط **"Save Changes"**

---

### الخطوة 3: إعادة نشر Frontend

1. في نفس الصفحة (`hospital-frontend`)
2. اضغط **"Manual Deploy"** (في القائمة العلوية)
3. اختر **"Deploy latest commit"**
4. انتظر حتى ينتهي البناء (2-3 دقائق)

---

### الخطوة 4: تحقق من Backend

1. افتح في متصفح جديد:
   ```
   https://hospital-api-7v73.onrender.com/api/health
   ```
2. يجب أن ترى:
   ```json
   {
     "status": "OK",
     "message": "Server is running"
   }
   ```
3. إذا لم يعمل:
   - اذهب إلى Render → `hospital-api` → **"Logs"**
   - تحقق من الأخطاء

---

### الخطوة 5: تحقق من CORS في Backend

1. اذهب إلى Render → `hospital-api` → **"Environment"**
2. تأكد من `CLIENT_URL`:
   ```
   CLIENT_URL=https://hospital-frontend-wrxu.onrender.com
   ```
3. إذا لم يكن موجوداً، أضفه واضغط **"Save Changes"**
4. أعد نشر Backend: **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🔍 التحقق من الإصلاح

### 1. افتح Developer Tools (F12)

في Console يجب أن ترى:
```
API Base URL: https://hospital-api-7v73.onrender.com
```

### 2. جرب تسجيل الدخول

استخدم:
- **Username**: `admin`
- **Password**: `admin123`

### 3. تحقق من Network Tab

في Developer Tools → **Network**:
- يجب أن ترى طلب إلى: `https://hospital-api-7v73.onrender.com/api/auth/login`
- Status يجب أن يكون `200` (نجح) أو `401` (بيانات خاطئة)

---

## 🐛 حل المشاكل الشائعة

### المشكلة: "API Base URL: http://localhost:5001"

**السبب**: `REACT_APP_API_URL` غير مضبوط في Render

**الحل**:
1. Render → `hospital-frontend` → Environment
2. أضف: `REACT_APP_API_URL=https://hospital-api-7v73.onrender.com`
3. أعد النشر

---

### المشكلة: "Network Error" أو "ERR_NETWORK"

**السبب**: Backend غير متاح أو CORS غير مضبوط

**الحل**:
1. تحقق من Backend: `https://hospital-api-7v73.onrender.com/api/health`
2. إذا لم يعمل، تحقق من Logs في Render
3. تأكد من `CLIENT_URL` في Backend Environment

---

### المشكلة: "CORS Error"

**السبب**: `CLIENT_URL` غير مضبوط في Backend

**الحل**:
1. Render → `hospital-api` → Environment
2. أضف: `CLIENT_URL=https://hospital-frontend-wrxu.onrender.com`
3. أعد النشر

---

### المشكلة: "Timeout" أو "ECONNABORTED"

**السبب**: Backend "نائم" (Free Plan)

**الحل**:
- انتظر 30-60 ثانية وحاول مرة أخرى
- أو ترقية إلى Paid Plan ($7/شهر) لتفعيل "Always On"

---

### المشكلة: "401 Unauthorized"

**السبب**: بيانات الاعتماد خاطئة

**الحل**:
استخدم الحسابات الافتراضية:
- `admin` / `admin123`
- `inquiry` / `inquiry123`
- `lab` / `lab123`
- `pharmacy` / `pharmacy123`
- `doctor` / `doctor123`

---

## 📋 Checklist سريع

- [ ] `REACT_APP_API_URL` مضبوط في Frontend Environment
- [ ] `CLIENT_URL` مضبوط في Backend Environment
- [ ] Frontend تم إعادة نشره
- [ ] Backend تم إعادة نشره
- [ ] Backend يعمل: `https://hospital-api-7v73.onrender.com/api/health`
- [ ] Console يظهر: `API Base URL: https://hospital-api-7v73.onrender.com`

---

## 🆘 إذا لم يعمل بعد

1. **تحقق من Logs**:
   - Frontend: Render → `hospital-frontend` → Logs
   - Backend: Render → `hospital-api` → Logs

2. **تحقق من Environment Variables**:
   - Frontend: `REACT_APP_API_URL=https://hospital-api-7v73.onrender.com`
   - Backend: `CLIENT_URL=https://hospital-frontend-wrxu.onrender.com`

3. **تحقق من URLs**:
   - Frontend: `https://hospital-frontend-wrxu.onrender.com`
   - Backend: `https://hospital-api-7v73.onrender.com`

---

## ✅ بعد الإصلاح

بعد تطبيق هذه الخطوات:
1. ✅ تسجيل الدخول يعمل
2. ✅ الواجهة تظهر بشكل صحيح
3. ✅ الاتصال بين Frontend و Backend يعمل

---

**ملاحظة**: إذا استمرت المشكلة، أرسل لي:
- Screenshot من Console (F12)
- Screenshot من Network Tab
- Screenshot من Render Logs
