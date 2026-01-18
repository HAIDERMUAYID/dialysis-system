# 📤 تعليمات رفع المشروع على GitHub

## المشكلة الحالية
تم عمل commit بنجاح، لكن عملية الرفع (push) تحتاج إلى مصادقة GitHub.

## الحلول الممكنة

### الحل 1: إعداد Git Credential Helper (موصى به)

```bash
# إعداد اسم المستخدم والبريد الإلكتروني
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# إعداد credential helper لحفظ بيانات الدخول
git config --global credential.helper osxkeychain

# محاولة الرفع مرة أخرى
git push --set-upstream origin main
```

عند الطلب، أدخل:
- **Username**: اسم المستخدم على GitHub
- **Password**: Personal Access Token (ليس كلمة المرور العادية)

### الحل 2: استخدام Personal Access Token

1. اذهب إلى GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. أنشئ token جديد مع صلاحيات `repo`
3. استخدم الـ token ككلمة مرور عند الرفع

### الحل 3: استخدام SSH بدلاً من HTTPS

```bash
# تغيير remote URL إلى SSH
git remote set-url origin git@github.com:HAIDERMUAYID/dialysis-system.git

# محاولة الرفع
git push --set-upstream origin main
```

**ملاحظة**: يجب أن يكون لديك SSH key مضاف إلى GitHub.

### الحل 4: إعداد Git محلياً فقط (للمشروع الحالي)

```bash
# إعداد اسم المستخدم والبريد للمشروع فقط
git config user.name "Your Name"
git config user.email "your.email@example.com"

# محاولة الرفع
git push --set-upstream origin main
```

---

## خطوات سريعة (الأسهل)

```bash
# 1. إعداد Git
git config --global user.name "Haider Muayid"
git config --global user.email "haider.m@example.com"

# 2. إعداد credential helper
git config --global credential.helper osxkeychain

# 3. محاولة الرفع
git push --set-upstream origin main
```

---

## ملاحظات مهمة

1. **Personal Access Token**: GitHub لم يعد يقبل كلمات المرور العادية، يجب استخدام Personal Access Token
2. **SSL Certificate**: إذا واجهت مشكلة في شهادة SSL، يمكنك تعطيلها مؤقتاً:
   ```bash
   git config http.sslVerify false
   ```
   (غير موصى به للأمان)

3. **التحقق من الحالة**: 
   ```bash
   git status
   git log --oneline -5
   ```

---

## إذا استمرت المشكلة

1. تأكد من أن المستودع موجود على GitHub
2. تأكد من أن لديك صلاحيات الكتابة على المستودع
3. جرب إنشاء مستودع جديد على GitHub وربطه:
   ```bash
   git remote remove origin
   git remote add origin https://github.com/HAIDERMUAYID/dialysis-system.git
   git push --set-upstream origin main
   ```

---

## ✅ بعد الرفع الناجح

ستتمكن من:
- رؤية المشروع على GitHub
- مشاركة المشروع مع الآخرين
- عمل نسخ احتياطية تلقائية
- التعاون مع فريق العمل

---

**نصيحة**: استخدم Personal Access Token بدلاً من كلمة المرور العادية للأمان الأفضل.
