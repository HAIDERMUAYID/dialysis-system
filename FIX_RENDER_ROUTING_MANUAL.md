# 🔧 حل مشكلة Routing على Render - إضافة Redirect/Rewrite يدوياً

## ❌ **المشكلة**

عند الدخول إلى `/login` أو `/lab` أو أي route آخر، يظهر "Not Found".
المشكلة: Render Static Sites قد لا تقرأ `static.json` تلقائياً.

## ✅ **الحل: إضافة Redirect/Rewrite في Render Dashboard**

يجب إضافة Redirect/Rewrite rule يدوياً في Render Dashboard.

---

## 📋 **الخطوات:**

### **1. افتح Render Dashboard**
- اذهب إلى: https://dashboard.render.com
- سجل دخول إلى حسابك

### **2. اختر Service**
- اضغط على `hospital-frontend` service (Static Site)

### **3. افتح Settings**
- من القائمة الجانبية، اضغط على **"Settings"** أو **"الإعدادات"**

### **4. ابحث عن "Redirects / Rewrites"**
- قم بالتمرير لأسفل حتى تجد قسم **"Redirects / Rewrites"**
- أو ابحث عن **"Static Site Settings"**

### **5. أضف Redirect Rule**
اضغط على **"Add Redirect"** أو **"Add Rewrite"** وأضف:

#### **Option 1: Rewrite (الأفضل)**
| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | **Rewrite** |

#### **Option 2: Redirect (يعمل أيضاً)**
| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | **Redirect** |

**ملاحظة:** استخدم **Rewrite** أفضل من Redirect لأنه لا يغير URL في المتصفح.

### **6. احفظ التغييرات**
- اضغط **"Save"** أو **"حفظ"**

### **7. انتظر إعادة النشر**
- Render سيعيد نشر الموقع تلقائياً
- أو اضغط **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🧪 **الاختبار**

بعد إعادة النشر:

1. **جرّب الدخول مباشرة:**
   - `https://hospital-frontend-wrxu.onrender.com/login`
   - `https://hospital-frontend-wrxu.onrender.com/lab`
   - يجب أن تعمل ✅

2. **جرّب عمل Refresh:**
   - افتح أي صفحة
   - اضغط F5 أو زر Refresh
   - يجب أن تعمل ✅

---

## 🔍 **إذا لم تجد "Redirects / Rewrites"**

بعض الخدمات قد تستخدم أسماء مختلفة:
- **"Custom Redirects"**
- **"URL Rewrites"**
- **"Routing Rules"**
- **"Static Site Configuration"**

إذا لم تجد أي من هذه، جرب:

### **الحل البديل: تغيير نوع الخدمة**

إذا كانت خدمتك من نوع **"Static Site"** وتفتقر إلى خيارات Redirects:

1. **احذف الخدمة الحالية** (لا تقلق، البيانات آمنة في GitHub)
2. **أنشئ خدمة جديدة من نوع "Web Service"**
3. استخدم الإعدادات التالية:
   - **Environment:** Static
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish Directory:** `client/build`
   - **Start Command:** `npx serve -s build -l 3000` (أو استخدم serve package)

---

## ✅ **بعد إضافة Redirect**

- ✅ جميع الروابط ستعمل مباشرة
- ✅ Refresh سيعمل على أي صفحة
- ✅ React Router سيعمل بشكل صحيح

---

## 🎯 **ملخص سريع**

1. **Render Dashboard** → **hospital-frontend** → **Settings**
2. **Redirects / Rewrites** → **Add Redirect**
3. **Source:** `/*` | **Destination:** `/index.html` | **Action:** Rewrite
4. **Save** → **انتظر النشر**
5. **جرّب `/login`** - يجب أن يعمل! ✅

---

**إذا واجهت أي مشكلة، أخبرني!** 🚀
