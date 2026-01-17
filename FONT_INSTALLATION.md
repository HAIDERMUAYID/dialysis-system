# كيفية إضافة الخط العربي لـ PDF

## الخطوة 1: تحميل الخط العربي

قم بتحميل أحد الخطوط التالية (اختر واحد):

1. **Amiri** (موصى به)
   - الرابط: https://fonts.google.com/specimen/Amiri
   - اضغط على "Download family"
   - استخرج الملف وقم بنسخ `Amiri-Regular.ttf`

2. **Cairo**
   - الرابط: https://fonts.google.com/specimen/Cairo
   - اضغط على "Download family"
   - استخرج الملف وقم بنسخ `Cairo-Regular.ttf`

## الخطوة 2: وضع الخط في المجلد الصحيح

1. انسخ ملف الخط (`.ttf`) إلى المجلد التالي:
   ```
   server/fonts/Amiri-Regular.ttf
   ```
   أو
   ```
   server/fonts/Cairo-Regular.ttf
   ```

2. تأكد من أن اسم الملف صحيح

## الخطوة 3: إعادة تشغيل السيرفر

بعد إضافة الخط، قم بإعادة تشغيل السيرفر:
```bash
npm run server
```

## ملاحظات

- إذا لم تجد الخط، سيستخدم النظام الخط الافتراضي (Helvetica) والنصوص العربية قد لا تظهر بشكل مثالي
- يمكنك استخدام أي خط عربي آخر (TTF) - فقط ضعه في مجلد `server/fonts/`
