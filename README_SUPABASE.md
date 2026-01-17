# دليل سريع: Supabase + Prisma

## البدء السريع

### 1. إنشاء حساب Supabase
- اذهب إلى https://supabase.com
- أنشئ حساب جديد (مجاني)
- أنشئ مشروع جديد واحفظ كلمة المرور

### 2. الحصول على Connection String
- في Supabase Dashboard: **Settings** → **Database**
- انسخ **Connection string** → **URI**
- استبدل `[YOUR-PASSWORD]` بكلمة المرور

### 3. إعداد المشروع
```bash
# تثبيت المتطلبات
npm install

# إعداد .env
cp .env.example .env
# عدّل DATABASE_URL في .env

# توليد Prisma Client
npm run prisma:generate

# إنشاء قاعدة البيانات
npm run prisma:migrate
```

### 4. تشغيل التطبيق
```bash
npm run dev
```

## الملفات المهمة

- `prisma/schema.prisma` - تعريف قاعدة البيانات
- `server/database/db-prisma.js` - واجهة Prisma
- `SUPABASE_DEPLOYMENT.md` - دليل النشر الكامل

## الأوامر المفيدة

```bash
# عرض البيانات
npm run prisma:studio

# إنشاء migration جديد
npm run prisma:migrate

# تطبيق migrations على الإنتاج
npm run prisma:deploy
```

## الحسابات الافتراضية

بعد تشغيل `prisma:migrate`، سيتم إنشاء الحسابات التالية:

- **admin** / admin123
- **inquiry** / inquiry123
- **lab** / lab123
- **lab_manager** / lab_manager123
- **pharmacist** / pharmacist123
- **pharmacy_manager** / pharmacy_manager123
- **doctor** / doctor123

⚠️ **غيّر كلمات المرور فوراً في الإنتاج!**
