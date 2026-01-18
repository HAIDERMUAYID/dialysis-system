# 🔄 تغيير أسماء الخدمات في Render

## 🎯 الأسماء الجديدة

- **Backend**: `alhakeem-hospital-api` (أو `مستشفى-الحكيم-api`)
- **Frontend**: `alhakeem-hospital` (أو `مستشفى-الحكيم`)
- **Database**: `alhakeem-hospital-db`

---

## ✅ خطوات تغيير الأسماء

### 1. تغيير اسم Backend

1. في Render Dashboard:
   - اضغط على خدمة `hospital-api`
   - اضغط **"Settings"**

2. في **"Name"**، غيّره إلى:
   ```
   alhakeem-hospital-api
   ```
   أو بالعربية:
   ```
   مستشفى-الحكيم-api
   ```

3. اضغط **"Save Changes"**

4. URL الجديد سيكون:
   ```
   https://alhakeem-hospital-api.onrender.com
   ```

### 2. تغيير اسم Frontend

1. في Render Dashboard:
   - اضغط على خدمة `hospital-frontend`
   - اضغط **"Settings"**

2. في **"Name"**، غيّره إلى:
   ```
   alhakeem-hospital
   ```
   أو بالعربية:
   ```
   مستشفى-الحكيم
   ```

3. اضغط **"Save Changes"**

4. URL الجديد سيكون:
   ```
   https://alhakeem-hospital.onrender.com
   ```

### 3. تحديث Environment Variables

#### في Backend (`alhakeem-hospital-api`):
```
CLIENT_URL=https://alhakeem-hospital.onrender.com
```

#### في Frontend (`alhakeem-hospital`):
```
REACT_APP_API_URL=https://alhakeem-hospital-api.onrender.com
```

---

## 📝 ملاحظات

- ✅ تغيير الاسم مجاني
- ✅ URL سيتغير تلقائياً
- ✅ SSL مجاني تلقائياً
- ⚠️ قد يستغرق التحديث دقيقة أو دقيقتين

---

## 🌐 (اختياري) إعداد نطاق مخصص

إذا أردت نطاق مخصص مثل `alhakeem.hospital`:

1. اشترِ النطاق من:
   - Namecheap: https://www.namecheap.com
   - GoDaddy: https://www.godaddy.com

2. في Render:
   - Settings → Custom Domains
   - أضف النطاق واتبع التعليمات

3. أضف DNS records في موقع شراء النطاق

**راجع `CUSTOM_DOMAIN_SETUP.md` للتفاصيل الكاملة**

---

**بعد تغيير الأسماء، URLs الجديدة ستعمل فوراً! ✅**
