# 🔑 رفع المشروع باستخدام Personal Access Token

## الطريقة السريعة (موصى بها)

### استخدم السكريبت:
```bash
./push-with-token.sh
```

سيطلب منك إدخال الـ Token، ثم سيرفع المشروع تلقائياً.

---

## الطريقة اليدوية

### 1. إعداد Remote مع Token:
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/HAIDERMUAYID/dialysis-system.git
```

**استبدل `YOUR_TOKEN` بالـ Token الخاص بك**

### 2. رفع المشروع:
```bash
git push --set-upstream origin main
```

---

## الطريقة البديلة (إدخال Token عند الطلب)

### 1. إعادة تعيين Remote:
```bash
git remote set-url origin https://github.com/HAIDERMUAYID/dialysis-system.git
```

### 2. إعداد Git لطلب المصادقة:
```bash
git config credential.helper store
```

### 3. محاولة الرفع:
```bash
git push --set-upstream origin main
```

عند الطلب:
- **Username**: `HAIDERMUAYID`
- **Password**: الصق الـ Token

---

## إزالة Token من URL (بعد الرفع)

لأسباب أمنية، بعد الرفع الناجح:

```bash
git remote set-url origin https://github.com/HAIDERMUAYID/dialysis-system.git
```

ثم استخدم credential helper لحفظ الـ Token بشكل آمن.

---

## ملاحظات أمنية

⚠️ **مهم**: 
- لا تشارك الـ Token مع أحد
- لا ترفع الـ Token في الكود
- استخدم credential helper لحفظه بشكل آمن

---

## إذا استمرت المشكلة

### حل 1: استخدام SSH
```bash
# إنشاء SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# عرض المفتاح
cat ~/.ssh/id_ed25519.pub

# أضف المفتاح إلى GitHub: https://github.com/settings/keys
# ثم غيّر remote:
git remote set-url origin git@github.com:HAIDERMUAYID/dialysis-system.git
git push --set-upstream origin main
```

### حل 2: استخدام GitHub CLI
```bash
brew install gh
gh auth login
git push --set-upstream origin main
```
