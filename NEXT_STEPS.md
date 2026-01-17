# الخطوات التالية بعد نجاح الاتصال مع Supabase

## ✅ ما تم إنجازه

1. ✅ إعداد Prisma Schema
2. ✅ الاتصال بـ Supabase
3. ✅ إنشاء/تحديث الجداول في قاعدة البيانات

## الخطوات التالية

### 1. التحقق من نجاح العملية

بعد اكتمال `npx prisma db push`، يجب أن ترى رسالة:
```
✔ Your database is now in sync with your Prisma schema.
```

### 2. عرض البيانات (اختياري)

```bash
npm run prisma:studio
```

هذا سيفتح واجهة رسومية لعرض وتعديل البيانات في المتصفح.

### 3. تحديث الكود لاستخدام Prisma

الآن يجب تحديث Routes في `server/routes/` لاستخدام Prisma بدلاً من SQL queries المباشرة.

**مثال:**

**قبل (SQL مباشر):**
```javascript
const users = await db.allQuery('SELECT * FROM users WHERE role = ?', [role]);
```

**بعد (Prisma):**
```javascript
const db = require('../database/db');
const users = await db.prisma.user.findMany({
  where: { role: role }
});
```

### 4. اختبار النظام

```bash
# تشغيل الخادم
npm run server

# في terminal آخر، تشغيل الواجهة
cd client && npm start
```

### 5. التحقق من البيانات الافتراضية

بعد تشغيل النظام، يجب أن تجد:
- الأدوار الافتراضية (admin, inquiry, lab, etc.)
- المستخدمين الافتراضيين

يمكنك التحقق من ذلك عبر:
- `npm run prisma:studio`
- أو تسجيل الدخول بالحسابات الافتراضية

## الحسابات الافتراضية

بعد إنشاء الجداول، يجب أن تجد الحسابات التالية:

- **admin** / admin123
- **inquiry** / inquiry123
- **lab** / lab123
- **lab_manager** / lab_manager123
- **pharmacist** / pharmacist123
- **pharmacy_manager** / pharmacy_manager123
- **doctor** / doctor123

⚠️ **غيّر كلمات المرور فوراً في الإنتاج!**

## تحديث Routes لاستخدام Prisma

### مثال: تحديث `server/routes/auth.js`

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

### مثال: إنشاء مستخدم جديد

```javascript
// بدلاً من:
// await db.runQuery('INSERT INTO users ...', [...]);

// استخدم:
const newUser = await db.prisma.user.create({
  data: {
    username: 'newuser',
    password: hashedPassword,
    role: 'inquiry',
    name: 'New User'
  }
});
```

## الأوامر المفيدة

```bash
# عرض البيانات
npm run prisma:studio

# إنشاء migration جديد
npm run prisma:migrate

# تطبيق migrations على الإنتاج
npm run prisma:deploy

# توليد Prisma Client (بعد تحديث schema)
npm run prisma:generate
```

## ملاحظات مهمة

1. **Prisma Client**: بعد أي تغيير في `schema.prisma`، شغّل `npm run prisma:generate`
2. **Migrations**: استخدم `prisma migrate` للإنتاج، و`db push` للاختبار فقط
3. **Type Safety**: Prisma يوفر type safety كامل - استفد منه!
4. **Relations**: استخدم `include` أو `select` لجلب البيانات المرتبطة

## استكشاف الأخطاء

### إذا ظهر خطأ "Prisma Client not generated":
```bash
npm run prisma:generate
```

### إذا ظهر خطأ في الاتصال:
- تحقق من `prisma/.env` و`DATABASE_URL`
- تأكد من أن Supabase يعمل

### إذا لم تظهر البيانات الافتراضية:
- تحقق من `server/database/db-prisma.js`
- تأكد من أن `insertDefaultData()` تم استدعاؤها

## الخطوة التالية الموصى بها

1. ✅ اكتمل: الاتصال بـ Supabase
2. ✅ اكتمل: إنشاء الجداول
3. ⏭️ التالي: تحديث Routes لاستخدام Prisma
4. ⏭️ التالي: اختبار النظام
5. ⏭️ التالي: النشر على الإنتاج
