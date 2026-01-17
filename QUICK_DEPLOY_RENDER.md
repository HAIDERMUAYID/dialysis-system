# ⚡ نشر سريع على Render.com - خطوة بخطوة

## 🎯 الخطوات السريعة (15 دقيقة)

### الخطوة 1: إعداد Render.com

1. اذهب إلى: **https://dashboard.render.com**
2. سجل دخول باستخدام GitHub
3. اضغط **"New +"** → **"PostgreSQL"**

### الخطوة 2: إنشاء قاعدة البيانات

1. **Name**: `hospital-db`
2. **Database**: `hospital_db`
3. **User**: `hospital_user`
4. **Region**: اختر أقرب منطقة
5. اضغط **"Create Database"**
6. **انسخ Internal Database URL** (ستحتاجه لاحقاً)

### الخطوة 3: نشر Backend

1. في Render Dashboard:
   - اضغط **"New +"** → **"Web Service"**
   - اختر **"Connect GitHub repository"**
   - اختر مستودع `dialysis-system`

2. **الإعدادات الأساسية:**
   - **Name**: `hospital-api`
   - **Region**: نفس منطقة قاعدة البيانات
   - **Branch**: `main`
   - **Root Directory**: `.` (اتركه فارغاً)

3. **Build & Deploy:**
   - **Environment**: `Node`
   - **Build Command**: 
     ```bash
     npm install && cd client && npm install && cd .. && npm run build && npx prisma generate && npx prisma migrate deploy
     ```
   - **Start Command**: 
     ```bash
     npm start
     ```

4. **Environment Variables:**
   اضغط "Advanced" → "Add Environment Variable":
   ```
   NODE_ENV=production
   PORT=5001
   DATABASE_URL=<Internal Database URL من الخطوة 2>
   JWT_SECRET=<مفتاح قوي - مثال: $(openssl rand -hex 32)>
   CLIENT_URL=https://hospital-frontend.onrender.com
   ```

5. اضغط **"Create Web Service"**

### الخطوة 4: نشر Frontend

1. في Render Dashboard:
   - اضغط **"New +"** → **"Static Site"**
   - اختر نفس المستودع

2. **الإعدادات:**
   - **Name**: `hospital-frontend`
   - **Branch**: `main`
   - **Root Directory**: `client`
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Publish Directory**: `build`

3. **Environment Variables:**
   ```
   REACT_APP_API_URL=https://hospital-api.onrender.com
   ```

4. اضغط **"Create Static Site"**

### الخطوة 5: تحديث قاعدة البيانات

بعد نشر Backend:

1. في Render Dashboard، اضغط على خدمة `hospital-api`
2. اضغط **"Shell"** (في القائمة الجانبية)
3. شغّل الأوامر:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

### الخطوة 6: تحديث CLIENT_URL

1. في خدمة `hospital-api`:
   - اضغط **"Environment"**
   - عدّل `CLIENT_URL` إلى:
     ```
     CLIENT_URL=https://hospital-frontend.onrender.com
     ```
   - اضغط **"Save Changes"**

### الخطوة 7: إعادة التشغيل

1. في خدمة `hospital-api`:
   - اضغط **"Manual Deploy"** → **"Deploy latest commit"**

---

## ✅ التحقق من النشر

1. **Backend**: افتح `https://hospital-api.onrender.com/api/health`
2. **Frontend**: افتح `https://hospital-frontend.onrender.com`
3. **تسجيل الدخول**: استخدم الحسابات الافتراضية

---

## 🔧 إصلاح المشاكل الشائعة

### المشكلة: "Cannot connect to database"
**الحل**: تأكد من استخدام **Internal Database URL** وليس External

### المشكلة: "Build failed"
**الحل**: تحقق من Build Logs في Render

### المشكلة: "Frontend لا يتصل بالـ Backend"
**الحل**: تأكد من `REACT_APP_API_URL` في Frontend

---

## 📝 ملاحظات مهمة

- ✅ Render مجاني للمشاريع الصغيرة
- ✅ قد يستغرق البناء 5-10 دقائق في المرة الأولى
- ✅ الخدمات المجانية قد "تنام" بعد 15 دقيقة من عدم الاستخدام
- ✅ يمكنك ترقية الخطة لتفعيل "Always On"

---

## 🎉 بعد النشر

المشروع الآن متاح على:
- **Frontend**: `https://hospital-frontend.onrender.com`
- **Backend**: `https://hospital-api.onrender.com`

**مبروك! 🎊**
