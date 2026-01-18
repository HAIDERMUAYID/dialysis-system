# 🌐 دليل نشر النظام على الويب - شامل ومحدث

## 📋 نظرة عامة

هذا الدليل يشرح كيفية نشر نظام إدارة مستشفى الحكيم على الويب باستخدام أفضل المنصات المتاحة.

---

## 🎯 خيارات النشر الموصى بها

### 1. **Render.com** ⭐ (موصى به - مجاني)
- ✅ مجاني للمشاريع الصغيرة
- ✅ دعم Node.js و React
- ✅ قاعدة بيانات مجانية (PostgreSQL)
- ✅ SSL مجاني
- ✅ نشر تلقائي من GitHub

### 2. **Railway.app** ⭐ (موصى به - مجاني)
- ✅ مجاني مع 500 ساعة/شهر
- ✅ نشر سريع وسهل
- ✅ قاعدة بيانات PostgreSQL مجانية
- ✅ SSL مجاني

### 3. **Vercel** (للـ Frontend فقط)
- ✅ مجاني
- ✅ سريع جداً
- ⚠️ يحتاج Backend منفصل

### 4. **DigitalOcean** (مدفوع - $6/شهر)
- ✅ سيطرة كاملة
- ✅ أداء عالي
- ✅ مناسب للإنتاج

### 5. **Heroku** (مدفوع)
- ✅ سهل الاستخدام
- ⚠️ لم يعد مجانياً

---

## 🚀 الطريقة 1: النشر على Render.com (موصى به)

### الخطوة 1: إعداد المشروع للنشر

#### 1.1 تحديث package.json
```json
{
  "scripts": {
    "build": "cd client && npm install && npm run build",
    "start": "node server/index.js",
    "postinstall": "npm run build && prisma generate"
  }
}
```

#### 1.2 إنشاء ملف render.yaml (اختياري)
```yaml
services:
  - type: web
    name: hospital-system
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5001
      - key: DATABASE_URL
        fromDatabase:
          name: hospital-db
          property: connectionString
```

### الخطوة 2: إنشاء قاعدة بيانات على Render

1. اذهب إلى: https://dashboard.render.com
2. اضغط "New +" → "PostgreSQL"
3. اختر:
   - **Name**: `hospital-db`
   - **Database**: `hospital_db`
   - **User**: `hospital_user`
   - **Region**: أقرب منطقة لك
4. اضغط "Create Database"
5. انسخ **Internal Database URL**

### الخطوة 3: نشر Backend

1. في Render Dashboard:
   - اضغط "New +" → "Web Service"
   - اربط مستودع GitHub الخاص بك
   - اختر المشروع `dialysis-system`

2. الإعدادات:
   - **Name**: `hospital-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `.` (المجلد الرئيسي)

3. Environment Variables:
   ```
   NODE_ENV=production
   PORT=5001
   DATABASE_URL=<Internal Database URL من الخطوة 2>
   JWT_SECRET=<مفتاح قوي وعشوائي>
   CLIENT_URL=https://your-frontend-url.onrender.com
   ```

4. اضغط "Create Web Service"

### الخطوة 4: نشر Frontend

1. في Render Dashboard:
   - اضغط "New +" → "Static Site"
   - اربط نفس المستودع

2. الإعدادات:
   - **Name**: `hospital-frontend`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/build`

3. Environment Variables:
   ```
   REACT_APP_API_URL=https://hospital-api.onrender.com
   ```

4. اضغط "Create Static Site"

### الخطوة 5: تحديث قاعدة البيانات

بعد النشر، شغّل migrations:

```bash
# على Render، استخدم Shell أو SSH
npx prisma migrate deploy
npx prisma generate
```

---

## 🚂 الطريقة 2: النشر على Railway.app

### الخطوة 1: إنشاء حساب على Railway

1. اذهب إلى: https://railway.app
2. سجل دخول باستخدام GitHub

### الخطوة 2: إنشاء مشروع جديد

1. اضغط "New Project"
2. اختر "Deploy from GitHub repo"
3. اختر مستودع `dialysis-system`

### الخطوة 3: إضافة قاعدة بيانات

1. في المشروع، اضغط "New" → "Database" → "PostgreSQL"
2. Railway سينشئ قاعدة بيانات تلقائياً
3. انسخ **DATABASE_URL** من Variables

### الخطوة 4: إعداد Backend

1. اضغط "New" → "GitHub Repo"
2. اختر المستودع
3. في Settings:
   - **Root Directory**: `.`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. Environment Variables:
   ```
   NODE_ENV=production
   PORT=5001
   DATABASE_URL=<من قاعدة البيانات>
   JWT_SECRET=<مفتاح قوي>
   CLIENT_URL=https://your-app.railway.app
   ```

### الخطوة 5: إعداد Frontend

1. أنشئ خدمة جديدة للـ Frontend
2. Build Command: `cd client && npm install && npm run build`
3. Start Command: `npx serve -s build -l 3000`
4. Environment Variables:
   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   ```

---

## 🌍 الطريقة 3: النشر على Vercel (Frontend) + Railway (Backend)

### Frontend على Vercel:

1. اذهب إلى: https://vercel.com
2. اضغط "New Project"
3. اربط مستودع GitHub
4. الإعدادات:
   - **Framework Preset**: Create React App
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. Environment Variables:
   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   ```

### Backend على Railway:
اتبع الخطوات في "الطريقة 2" أعلاه.

---

## 🖥️ الطريقة 4: النشر على VPS (DigitalOcean/Vultr)

### الخطوة 1: إعداد الخادم

```bash
# الاتصال بالخادم
ssh root@your-server-ip

# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# تثبيت PM2
sudo npm install -g pm2

# تثبيت Nginx
sudo apt install nginx -y
```

### الخطوة 2: رفع المشروع

```bash
# على الخادم
cd /var/www
git clone https://github.com/HAIDERMUAYID/dialysis-system.git
cd dialysis-system
npm install
cd client && npm install && npm run build && cd ..
```

### الخطوة 3: إعداد قاعدة البيانات

استخدم Supabase (مجاني) أو أنشئ PostgreSQL على الخادم.

### الخطوة 4: إعداد Environment Variables

```bash
nano .env
```

```env
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-strong-secret-key
CLIENT_URL=https://yourdomain.com
```

### الخطوة 5: تشغيل التطبيق

```bash
# تحديث قاعدة البيانات
npx prisma migrate deploy
npx prisma generate

# تشغيل مع PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### الخطوة 6: إعداد Nginx

```bash
sudo nano /etc/nginx/sites-available/hospital
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend
    location / {
        root /var/www/dialysis-system/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### الخطوة 7: إعداد SSL

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🔧 إعدادات مهمة قبل النشر

### 1. تحديث server/index.js لدعم Production

```javascript
// في server/index.js
if (process.env.NODE_ENV === 'production') {
  // خدمة ملفات React
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}
```

### 2. تحديث client/package.json

```json
{
  "homepage": ".",
  "scripts": {
    "build": "react-scripts build"
  }
}
```

### 3. إنشاء ملف .env.production

```env
REACT_APP_API_URL=https://your-backend-url.com
```

---

## 📝 خطوات سريعة للنشر (Render.com)

### 1. إعداد المشروع:
```bash
# تحديث .gitignore
echo ".env" >> .gitignore
echo "node_modules" >> .gitignore
```

### 2. على Render:
- أنشئ PostgreSQL Database
- أنشئ Web Service للـ Backend
- أنشئ Static Site للـ Frontend
- أضف Environment Variables

### 3. بعد النشر:
```bash
# على Render Shell
npx prisma migrate deploy
npx prisma generate
```

---

## ✅ التحقق من النشر

1. **Backend**: `https://your-backend.onrender.com/api/health`
2. **Frontend**: `https://your-frontend.onrender.com`
3. **قاعدة البيانات**: تحقق من الاتصال

---

## 🔒 أمان الإنتاج

1. ✅ استخدم HTTPS دائماً
2. ✅ غيّر JWT_SECRET
3. ✅ استخدم كلمات مرور قوية
4. ✅ فعّل Rate Limiting
5. ✅ راجع Environment Variables

---

## 📞 الدعم

إذا واجهت مشاكل:
- راجع سجلات Render/Railway
- تحقق من Environment Variables
- تأكد من تحديث قاعدة البيانات

---

## 🎯 التوصية النهائية

**للبدء السريع**: استخدم **Render.com** - مجاني وسهل!

**للإنتاج**: استخدم **VPS (DigitalOcean)** - سيطرة كاملة!
