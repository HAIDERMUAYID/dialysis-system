# كيفية عرض الجداول والتحقق من البيانات

## 🎯 الطرق المتاحة لعرض الجداول

### 1. **من API Backend (الأسهل)**

#### أ. عرض جميع الجداول وعدد السجلات:
```bash
# بعد تسجيل الدخول كـ admin
GET https://hospital-api-7v73.onrender.com/api/admin/database/tables
```

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "database_type": "PostgreSQL",
  "total_tables": 19,
  "tables": [
    {
      "name": "activity_log",
      "columns": 7,
      "rows": 150
    },
    {
      "name": "diagnoses",
      "columns": 6,
      "rows": 45
    },
    {
      "name": "drugs_catalog",
      "columns": 9,
      "rows": 120
    },
    // ... المزيد
  ]
}
```

#### ب. استخدام Postman أو curl:
```bash
# مع Token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://hospital-api-7v73.onrender.com/api/admin/database/tables
```

### 2. **استخدام Prisma Studio (محلياً - أوصى به)**

#### الخطوات:

1. **احصل على DATABASE_URL من Render:**
   - اذهب إلى Render Dashboard
   - اختر PostgreSQL Database → `hospital-db`
   - اضغط "Connect" → انسخ "Internal Database URL"
   - أو استخدم "Connection Pooling URL"

2. **أنشئ ملف `.env` محلياً:**
   ```bash
   # في مجلد المشروع
   DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
   ```

3. **شغل Prisma Studio:**
   ```bash
   cd /Users/haider.m/Desktop/project/hosptal
   npx prisma studio
   ```

4. **ستفتح نافذة في المتصفح:**
   ```
   http://localhost:5555
   ```

5. **اختر أي جدول لعرض البيانات:**
   - `users` - المستخدمون
   - `patients` - المرضى
   - `visits` - الزيارات
   - `lab_results` - نتائج التحاليل
   - إلخ...

### 3. **من Render PostgreSQL Shell**

#### الخطوات:

1. **اذهب إلى Render Dashboard:**
   ```
   https://dashboard.render.com
   ```

2. **اختر PostgreSQL Database:**
   - اضغط على `hospital-db`

3. **اضغط على "Shell":**
   - سيفتح terminal متصل بقاعدة البيانات

4. **استخدم SQL Queries:**
   ```sql
   -- عرض جميع الجداول
   \dt
   
   -- عرض تفاصيل جدول معين
   \d patients
   
   -- عرض عدد السجلات في كل جدول
   SELECT 
     schemaname,
     tablename,
     (SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_name = tablename) as column_count
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;
   
   -- عرض بيانات من جدول
   SELECT * FROM patients LIMIT 10;
   SELECT * FROM users LIMIT 10;
   SELECT * FROM visits LIMIT 10;
   ```

### 4. **من Frontend (إذا أردت إضافة صفحة)**

يمكنك إضافة صفحة Admin لعرض الجداول:

```typescript
// في AdminDashboardModern.tsx
const [tables, setTables] = useState([]);

useEffect(() => {
  const fetchTables = async () => {
    try {
      const response = await axios.get('/api/admin/database/tables');
      setTables(response.data.tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };
  fetchTables();
}, []);

// عرض الجداول
{tables.map(table => (
  <Card key={table.name}>
    <Card.Meta 
      title={table.name}
      description={`${table.rows} سجل - ${table.columns} عمود`}
    />
  </Card>
))}
```

---

## 📊 الجداول المتوقعة في النظام

يجب أن تجد الجداول التالية:

### **الجداول الأساسية:**
1. ✅ `roles` - الأدوار
2. ✅ `permissions` - الصلاحيات
3. ✅ `role_permissions` - ربط الأدوار بالصلاحيات
4. ✅ `users` - المستخدمون

### **الجداول الطبية:**
5. ✅ `patients` - المرضى
6. ✅ `visits` - الزيارات
7. ✅ `lab_results` - نتائج التحاليل
8. ✅ `pharmacy_prescriptions` - الوصفات الطبية
9. ✅ `diagnoses` - التشخيصات
10. ✅ `visit_status_history` - تاريخ حالات الزيارات
11. ✅ `visit_attachments` - مرفقات الزيارات

### **الجداول الإدارية:**
12. ✅ `notifications` - الإشعارات
13. ✅ `activity_log` - سجل النشاطات

### **الجداول الكتالوجية:**
14. ✅ `lab_tests_catalog` - كتالوج التحاليل
15. ✅ `lab_test_panels` - مجموعات التحاليل
16. ✅ `lab_test_panel_items` - عناصر مجموعات التحاليل
17. ✅ `drugs_catalog` - كتالوج الأدوية
18. ✅ `prescription_sets` - مجموعات الوصفات
19. ✅ `prescription_set_items` - عناصر مجموعات الوصفات

---

## 🔍 التحقق من صحة البيانات

### **1. التحقق من وجود بيانات افتراضية:**
```sql
-- يجب أن تجد 4 أدوار على الأقل
SELECT * FROM roles;

-- يجب أن تجد 4 مستخدمين افتراضيين على الأقل
SELECT id, username, name, role FROM users;

-- التحقق من وجود جداول فارغة (عادي في البداية)
SELECT 
  'patients' as table_name, COUNT(*) as count FROM patients
UNION ALL
SELECT 'visits', COUNT(*) FROM visits
UNION ALL
SELECT 'lab_results', COUNT(*) FROM lab_results;
```

### **2. التحقق من بنية الجداول:**
```sql
-- عرض أعمدة جدول معين
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'patients'
ORDER BY ordinal_position;
```

---

## ⚠️ ملاحظات مهمة

1. **DATABASE_URL محمي:**
   - لا تشارك `DATABASE_URL` مع أحد
   - احفظه في `.env` فقط (غير موجود في Git)

2. **الوصول يحتاج Authentication:**
   - `/api/admin/database/tables` يحتاج تسجيل دخول كـ admin
   - استخدم Token من Login response

3. **Prisma Studio محلياً فقط:**
   - يعمل على `localhost:5555`
   - يحتاج اتصال بقاعدة البيانات من خلال `DATABASE_URL`

4. **Render Shell يحتاج حساب Render:**
   - يجب أن تكون مسجل دخول في Render Dashboard
   - Shell متاح فقط في Production

---

## 🚀 البدء السريع

**أسهل طريقة:**
```bash
# 1. احصل على DATABASE_URL من Render
# 2. ضعه في .env
# 3. شغل Prisma Studio
npx prisma studio
```

**أو من Browser (يحتاج admin login):**
```
GET /api/admin/database/tables
```
