# 🚀 دليل سريع لرفع المشروع على GitHub

## ⚡ الحل السريع (3 خطوات)

### الخطوة 1: إنشاء Personal Access Token
1. اذهب إلى: **https://github.com/settings/tokens**
2. اضغط **"Generate new token (classic)"**
3. اختر صلاحيات:
   - ✅ `repo` (كل الصلاحيات)
4. اضغط **"Generate token"**
5. **انسخ الـ Token** (لن تتمكن من رؤيته مرة أخرى!)

### الخطوة 2: استخدام الـ Token
في Terminal، عندما يطلب منك:
- **Username**: `HAIDERMUAYID`
- **Password**: الصق الـ Token (ليس كلمة المرور العادية)

### الخطوة 3: رفع المشروع
```bash
git push --set-upstream origin main
```

---

## 🔑 بديل: استخدام SSH (أكثر أماناً)

### إنشاء SSH Key:
```bash
# إنشاء SSH key جديد
ssh-keygen -t ed25519 -C "your.email@example.com"

# اضغط Enter للقيم الافتراضية
# أو أدخل كلمة مرور لحماية المفتاح

# عرض المفتاح العام
cat ~/.ssh/id_ed25519.pub
```

### إضافة المفتاح إلى GitHub:
1. انسخ محتوى `~/.ssh/id_ed25519.pub`
2. اذهب إلى: **https://github.com/settings/keys**
3. اضغط **"New SSH key"**
4. الصق المفتاح واحفظه

### تغيير Remote إلى SSH:
```bash
git remote set-url origin git@github.com:HAIDERMUAYID/dialysis-system.git
git push --set-upstream origin main
```

---

## 🛠️ بديل: استخدام GitHub CLI

```bash
# تثبيت GitHub CLI (إذا لم يكن مثبتاً)
brew install gh

# تسجيل الدخول
gh auth login

# رفع المشروع
git push --set-upstream origin main
```

---

## ✅ التحقق من النجاح

بعد الرفع الناجح:
```bash
git remote show origin
```

يجب أن ترى:
```
* remote origin
  Fetch URL: https://github.com/HAIDERMUAYID/dialysis-system.git
  Push  URL: https://github.com/HAIDERMUAYID/dialysis-system.git
  HEAD branch: main
```

---

## 🆘 إذا استمرت المشكلة

### حل 1: مسح بيانات المصادقة المحفوظة
```bash
git credential-osxkeychain erase
host=github.com
protocol=https
```

### حل 2: تعطيل SSL مؤقتاً (غير موصى به)
```bash
git config http.sslVerify false
git push --set-upstream origin main
```

### حل 3: استخدام URL مع Token مباشرة
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/HAIDERMUAYID/dialysis-system.git
git push --set-upstream origin main
```

---

## 📝 ملاحظات

- ✅ الـ commit موجود وجاهز (8f8dde8)
- ✅ المستودع موجود على GitHub
- ⏳ ينتظر المصادقة فقط

**أسرع حل**: استخدم Personal Access Token!
