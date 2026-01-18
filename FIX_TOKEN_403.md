# 🔧 حل مشكلة 403 - Permission Denied

## المشكلة
```
remote: Permission to HAIDERMUAYID/dialysis-system.git denied
fatal: unable to access '...': The requested URL returned error: 403
```

## الأسباب المحتملة

### 1. الـ Token لا يملك صلاحيات `repo` ✅ (الأكثر احتمالاً)
### 2. المستودع غير موجود على GitHub
### 3. الـ Token منتهي الصلاحية
### 4. الـ Token تم إنشاؤه لمستخدم آخر

---

## الحلول

### ✅ الحل 1: إنشاء Token جديد بصلاحيات كاملة

1. اذهب إلى: **https://github.com/settings/tokens**
2. احذف الـ Token القديم (إذا أردت)
3. اضغط **"Generate new token (classic)"**
4. اختر الصلاحيات:
   - ✅ **`repo`** (كل الصلاحيات) - **مهم جداً!**
   - ✅ `workflow` (اختياري)
5. اضغط **"Generate token"**
6. انسخ الـ Token الجديد

### ✅ الحل 2: التحقق من وجود المستودع

تأكد من أن المستودع موجود على GitHub:
- اذهب إلى: **https://github.com/HAIDERMUAYID/dialysis-system**
- إذا لم يكن موجوداً، أنشئه:
  1. اذهب إلى: **https://github.com/new**
  2. اسم المستودع: `dialysis-system`
  3. اختر **Private** أو **Public**
  4. **لا** تضع README أو .gitignore
  5. اضغط **"Create repository"**

### ✅ الحل 3: استخدام Token جديد

بعد الحصول على Token جديد بصلاحيات `repo`:

```bash
# إزالة Token القديم من URL
git remote set-url origin https://github.com/HAIDERMUAYID/dialysis-system.git

# إضافة Token الجديد
git remote set-url origin https://NEW_TOKEN@github.com/HAIDERMUAYID/dialysis-system.git

# محاولة الرفع
git push --set-upstream origin main
```

---

## طريقة بديلة: استخدام SSH

إذا استمرت المشكلة، استخدم SSH:

### 1. إنشاء SSH Key:
```bash
ssh-keygen -t ed25519 -C "your.email@example.com"
# اضغط Enter للقيم الافتراضية
```

### 2. عرض المفتاح:
```bash
cat ~/.ssh/id_ed25519.pub
```

### 3. إضافة المفتاح إلى GitHub:
- اذهب إلى: **https://github.com/settings/keys**
- اضغط **"New SSH key"**
- الصق المفتاح واحفظه

### 4. تغيير Remote إلى SSH:
```bash
git remote set-url origin git@github.com:HAIDERMUAYID/dialysis-system.git
git push --set-upstream origin main
```

---

## التحقق من Token

للتحقق من صلاحيات Token:
1. اذهب إلى: **https://github.com/settings/tokens**
2. اضغط على Token
3. تأكد من وجود ✅ بجانب `repo`

---

## ملاحظات مهمة

⚠️ **تأكد من:**
- ✅ Token له صلاحيات `repo` (كل الصلاحيات)
- ✅ المستودع موجود على GitHub
- ✅ Token لم ينتهِ صلاحيته
- ✅ أنت المالك أو لديك صلاحيات الكتابة

---

## الخطوات التالية

1. أنشئ Token جديد بصلاحيات `repo`
2. تأكد من وجود المستودع على GitHub
3. استخدم Token الجديد في الأمر:
   ```bash
   git remote set-url origin https://NEW_TOKEN@github.com/HAIDERMUAYID/dialysis-system.git
   git push --set-upstream origin main
   ```
