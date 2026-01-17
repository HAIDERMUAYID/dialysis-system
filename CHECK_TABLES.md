# التحقق من الجداول في قاعدة البيانات

## الطريقة 1: من Prisma Studio (الأسهل)

1. افتح Prisma Studio (إذا كان يعمل):
   ```bash
   npm run prisma:studio
   ```

2. اذهب إلى: http://localhost:5555

3. ستجد قائمة بجميع الجداول على الجانب الأيسر:
   - Role
   - Permission
   - RolePermission
   - User
   - Patient
   - Visit
   - LabResult
   - PharmacyPrescription
   - Diagnosis
   - وغيرها...

## الطريقة 2: من Supabase Dashboard

1. اذهب إلى https://supabase.com/dashboard
2. اختر مشروعك
3. اذهب إلى **Table Editor**
4. ستجد جميع الجداول في القائمة

## الطريقة 3: من Terminal (SQL Query)

```bash
# استخدام Prisma
npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

## الطريقة 4: التحقق من عدد الجداول

```bash
# عدد الجداول
npx prisma db execute --stdin <<< "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"
```

## الجداول المتوقعة

بعد تشغيل `npx prisma db push`، يجب أن تجد الجداول التالية:

1. **roles** - الأدوار
2. **permissions** - الصلاحيات
3. **role_permissions** - ربط الأدوار بالصلاحيات
4. **users** - المستخدمين
5. **patients** - المرضى
6. **visits** - الزيارات
7. **lab_results** - نتائج التحاليل
8. **pharmacy_prescriptions** - الوصفات الطبية
9. **diagnoses** - التشخيصات
10. **visit_status_history** - تاريخ حالة الزيارة
11. **notifications** - الإشعارات
12. **activity_log** - سجل الأنشطة
13. **lab_tests_catalog** - كتالوج التحاليل
14. **lab_test_panels** - مجموعات التحاليل
15. **lab_test_panel_items** - عناصر مجموعات التحاليل
16. **drugs_catalog** - كتالوج الأدوية
17. **prescription_sets** - مجموعات الوصفات
18. **prescription_set_items** - عناصر مجموعات الوصفات
19. **visit_attachments** - المرفقات

## التحقق من البيانات الافتراضية

### الأدوار (roles):
```sql
SELECT * FROM roles;
```

يجب أن تجد:
- admin
- inquiry
- lab
- lab_manager
- pharmacist
- pharmacy_manager
- doctor

### المستخدمين (users):
```sql
SELECT username, role, name FROM users;
```

يجب أن تجد الحسابات الافتراضية:
- admin / admin123
- inquiry / inquiry123
- lab / lab123
- lab_manager / lab_manager123
- pharmacist / pharmacist123
- pharmacy_manager / pharmacy_manager123
- doctor / doctor123

## إذا لم تكن الجداول موجودة

### الحل 1: إنشاء الجداول

```bash
npx prisma db push
```

### الحل 2: التحقق من الاتصال

```bash
# اختبار الاتصال
npx prisma db execute --stdin <<< "SELECT 1;"
```

### الحل 3: إعادة التعيين (⚠️ يحذف البيانات)

```bash
npx prisma migrate reset
npx prisma db push
```

## ملاحظات

- إذا رأيت الجداول في Prisma Studio، فهي موجودة ✅
- إذا رأيت الجداول في Supabase Dashboard، فهي موجودة ✅
- إذا لم ترها، شغّل `npx prisma db push` مرة أخرى
