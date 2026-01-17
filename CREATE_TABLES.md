# إنشاء الجداول في قاعدة البيانات

## المشكلة
الجداول غير موجودة في Supabase Dashboard (يظهر "No tables or views").

## الحل

### الخطوة 1: التحقق من الاتصال

تأكد من أن `prisma/.env` يحتوي على `DATABASE_URL` الصحيح:

```env
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
```

### الخطوة 2: إنشاء الجداول

شغّل الأمر التالي:

```bash
npx prisma db push
```

هذا الأمر سيقوم بـ:
1. قراءة `prisma/schema.prisma`
2. إنشاء جميع الجداول في قاعدة البيانات
3. إضافة العلاقات بين الجداول
4. إضافة البيانات الافتراضية (الأدوار والمستخدمين)

### الخطوة 3: التحقق من النجاح

بعد اكتمال الأمر، يجب أن ترى رسالة:
```
✔ Your database is now in sync with your Prisma schema.
```

### الخطوة 4: التحقق من الجداول

1. **من Supabase Dashboard:**
   - اذهب إلى Table Editor
   - يجب أن ترى 19 جدول

2. **من Prisma Studio:**
   ```bash
   npm run prisma:studio
   ```
   - افتح http://localhost:5555
   - ستجد جميع الجداول

## الجداول التي سيتم إنشاؤها

1. roles
2. permissions
3. role_permissions
4. users
5. patients
6. visits
7. lab_results
8. pharmacy_prescriptions
9. diagnoses
10. visit_status_history
11. notifications
12. activity_log
13. lab_tests_catalog
14. lab_test_panels
15. lab_test_panel_items
16. drugs_catalog
17. prescription_sets
18. prescription_set_items
19. visit_attachments

## إذا ظهر خطأ

### خطأ: "Environment variable not found: DATABASE_URL"
- تحقق من `prisma/.env`
- تأكد من وجود `DATABASE_URL`

### خطأ: "Can't reach database server"
- تحقق من `DATABASE_URL`
- تأكد من استخدام Connection Pooling (pooler.supabase.com:6543)

### خطأ: "Authentication failed"
- تحقق من كلمة المرور في `DATABASE_URL`
- تأكد من استبدال `[YOUR-PASSWORD]` بكلمة المرور الصحيحة

## بعد إنشاء الجداول

### التحقق من البيانات الافتراضية

1. **الأدوار (roles):**
   - اذهب إلى Table Editor → roles
   - يجب أن تجد: admin, inquiry, lab, lab_manager, pharmacist, pharmacy_manager, doctor

2. **المستخدمين (users):**
   - اذهب إلى Table Editor → users
   - يجب أن تجد الحسابات الافتراضية:
     - admin / admin123
     - inquiry / inquiry123
     - lab / lab123
     - lab_manager / lab_manager123
     - pharmacist / pharmacist123
     - pharmacy_manager / pharmacy_manager123
     - doctor / doctor123

## ملاحظات مهمة

- ⚠️ `db push` للاختبار والتطوير فقط
- للإنتاج، استخدم `prisma migrate` بدلاً من `db push`
- بعد أي تغيير في `schema.prisma`، شغّل `npm run prisma:generate`

## الخطوة التالية

بعد إنشاء الجداول:
1. ✅ تحقق من الجداول في Supabase Dashboard
2. ✅ تحقق من البيانات الافتراضية
3. ⏭️ تحديث Routes لاستخدام Prisma
4. ⏭️ تشغيل النظام: `npm run dev`
