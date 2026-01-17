# الخطوات التالية بعد إنشاء الجداول

## ✅ ما تم إنجازه
- ✅ إنشاء جميع الجداول (19 جدول) في Supabase
- ✅ الجداول جاهزة للاستخدام

## الخطوات التالية

### 1. التحقق من الجداول

1. **من Supabase Dashboard:**
   - اذهب إلى **Table Editor**
   - يجب أن ترى 19 جدول

2. **من Prisma Studio:**
   ```bash
   npm run prisma:studio
   ```
   - افتح http://localhost:5555
   - ستجد جميع الجداول

### 2. إضافة البيانات الافتراضية

#### الطريقة 1: من خلال التطبيق (موصى به)

بعد تشغيل النظام، سيتم إضافة البيانات الافتراضية تلقائياً من `server/database/db-prisma.js`.

#### الطريقة 2: يدوياً من SQL Editor

1. اذهب إلى Supabase Dashboard → **SQL Editor**
2. انسخ محتوى `INSERT_DEFAULT_DATA.sql`
3. الصق في SQL Editor واضغط **Run**

**ملاحظة:** كلمات المرور في SQL هي placeholders. الأفضل إنشاء المستخدمين من خلال API الذي سيستخدم bcrypt.

### 3. توليد Prisma Client

```bash
npm run prisma:generate
```

هذا مهم جداً! Prisma Client يجب أن يكون محدثاً بعد إنشاء الجداول.

### 4. التحقق من Prisma Schema

```bash
npx prisma validate
```

يجب أن ترى: `The schema at prisma/schema.prisma is valid 🚀`

### 5. تحديث Routes لاستخدام Prisma

الآن يجب تحديث Routes في `server/routes/` لاستخدام Prisma بدلاً من SQL queries المباشرة.

**مثال: تحديث `server/routes/auth.js`**

```javascript
const db = require('../database/db');

// بدلاً من:
// const user = await db.getQuery('SELECT * FROM users WHERE username = ?', [username]);

// استخدم:
const user = await db.prisma.user.findUnique({
  where: { username: username },
  include: { roleRef: true }
});
```

### 6. تشغيل النظام

```bash
# تشغيل الخادم والواجهة معاً
npm run dev

# أو منفصل:
npm run server  # Backend على المنفذ 5001
cd client && npm start  # Frontend على المنفذ 3000
```

### 7. التحقق من النظام

1. افتح المتصفح: http://localhost:3000
2. جرب تسجيل الدخول بالحسابات الافتراضية:
   - **admin** / admin123
   - **inquiry** / inquiry123
   - **lab** / lab123
   - **doctor** / doctor123

## الملفات المهمة

### Routes التي تحتاج تحديث:

1. `server/routes/auth.js` - المصادقة
2. `server/routes/patients.js` - المرضى
3. `server/routes/visits.js` - الزيارات
4. `server/routes/lab.js` - التحاليل
5. `server/routes/pharmacy.js` - الصيدلية
6. `server/routes/doctor.js` - الطبيب
7. `server/routes/admin.js` - الإدارة
8. وغيرها...

### مثال على التحديث:

**قبل (SQL مباشر):**
```javascript
const users = await db.allQuery('SELECT * FROM users WHERE role = ?', [role]);
```

**بعد (Prisma):**
```javascript
const db = require('../database/db');
const users = await db.prisma.user.findMany({
  where: { role: role },
  include: { roleRef: true }
});
```

## الأوامر المفيدة

```bash
# توليد Prisma Client
npm run prisma:generate

# التحقق من Schema
npx prisma validate

# عرض البيانات
npm run prisma:studio

# تشغيل النظام
npm run dev
```

## ملاحظات مهمة

1. **Prisma Client**: بعد أي تغيير في `schema.prisma`، شغّل `npm run prisma:generate`
2. **Type Safety**: Prisma يوفر type safety كامل - استفد منه!
3. **Relations**: استخدم `include` أو `select` لجلب البيانات المرتبطة
4. **Migrations**: للإنتاج، استخدم `prisma migrate` بدلاً من `db push`

## الخطوة التالية الموصى بها

1. ✅ اكتمل: إنشاء الجداول
2. ⏭️ التالي: توليد Prisma Client (`npm run prisma:generate`)
3. ⏭️ التالي: تحديث Routes لاستخدام Prisma
4. ⏭️ التالي: تشغيل النظام (`npm run dev`)
5. ⏭️ التالي: اختبار النظام

## استكشاف الأخطاء

### إذا ظهر خطأ "Prisma Client not generated":
```bash
npm run prisma:generate
```

### إذا ظهر خطأ في Routes:
- تأكد من استخدام `db.prisma` بدلاً من `db.runQuery` أو `db.getQuery`
- راجع أمثلة Prisma في `server/database/db-prisma.js`

### إذا لم تظهر البيانات الافتراضية:
- تحقق من `server/database/db-prisma.js`
- تأكد من أن `insertDefaultData()` تم استدعاؤها
- أو أضف البيانات يدوياً من SQL Editor
