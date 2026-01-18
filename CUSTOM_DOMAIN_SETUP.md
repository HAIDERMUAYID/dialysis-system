# 🌐 إعداد نطاق مخصص: alhakeem.hospital أو مستشفى الحكيم

## 🎯 الخيارات المتاحة

### الخيار 1: استخدام Render Subdomain (مجاني)
- `hospital-api.onrender.com` → `alhakeem-hospital-api.onrender.com`
- `hospital-frontend.onrender.com` → `alhakeem-hospital.onrender.com`

### الخيار 2: نطاق مخصص (مدفوع)
- `alhakeem.hospital` (إذا كان متاحاً)
- `alhakeem-hospital.com`
- `alhakim-hospital.com`

---

## ✅ تغيير اسم الخدمة في Render

### للـ Backend:

1. في Render Dashboard:
   - اضغط على خدمة `hospital-api`
   - اضغط **"Settings"**

2. في **"Name"**، غيّره إلى:
   ```
   alhakeem-hospital-api
   ```
   أو
   ```
   مستشفى-الحكيم-api
   ```

3. اضغط **"Save Changes"**

4. URL الجديد سيكون:
   ```
   https://alhakeem-hospital-api.onrender.com
   ```

### للـ Frontend:

1. في Render Dashboard:
   - اضغط على خدمة `hospital-frontend`
   - اضغط **"Settings"`

2. في **"Name"**، غيّره إلى:
   ```
   alhakeem-hospital
   ```
   أو
   ```
   مستشفى-الحكيم
   ```

3. اضغط **"Save Changes"**

4. URL الجديد سيكون:
   ```
   https://alhakeem-hospital.onrender.com
   ```

---

## 🌐 إعداد نطاق مخصص (اختياري)

### الخطوة 1: شراء نطاق

مواقع موصى بها:
- **Namecheap**: https://www.namecheap.com
- **GoDaddy**: https://www.godaddy.com
- **Cloudflare**: https://www.cloudflare.com

ابحث عن:
- `alhakeem-hospital.com`
- `alhakim-hospital.com`
- `alhakeem-hospital.net`

### الخطوة 2: ربط النطاق في Render

#### للـ Backend:

1. في Render Dashboard → خدمة `alhakeem-hospital-api`
2. اضغط **"Settings"** → **"Custom Domains"**
3. اضغط **"Add Custom Domain"**
4. أدخل: `api.alhakeem-hospital.com`
5. اتبع التعليمات لإضافة DNS records

#### للـ Frontend:

1. في Render Dashboard → خدمة `alhakeem-hospital`
2. اضغط **"Settings"** → **"Custom Domains"**
3. اضغط **"Add Custom Domain"**
4. أدخل: `alhakeem-hospital.com`
5. اتبع التعليمات لإضافة DNS records

### الخطوة 3: إعداد DNS

في موقع شراء النطاق، أضف:

**للـ Frontend:**
```
Type: CNAME
Name: @
Value: alhakeem-hospital.onrender.com
```

**للـ Backend:**
```
Type: CNAME
Name: api
Value: alhakeem-hospital-api.onrender.com
```

---

## 🔧 تحديث Environment Variables

بعد تغيير الأسماء:

### في Backend:
```
CLIENT_URL=https://alhakeem-hospital.onrender.com
```

### في Frontend:
```
REACT_APP_API_URL=https://alhakeem-hospital-api.onrender.com
```

---

## 📝 ملاحظات

- ✅ تغيير الاسم في Render مجاني
- ✅ Render Subdomain مجاني
- ⚠️ نطاق مخصص يحتاج شراء (عادة $10-15/سنة)
- ✅ SSL مجاني تلقائياً في Render

---

## 🎯 التوصية

**للبدء السريع:**
- استخدم Render Subdomain: `alhakeem-hospital.onrender.com`

**لاحقاً:**
- اشترِ نطاق مخصص وربطه

---

**هل تريد تغيير الأسماء الآن في Render؟**
