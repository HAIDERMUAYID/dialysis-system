# توثيق API

## Base URL
```
http://localhost:5000/api
```

## المصادقة

جميع المسارات (ما عدا تسجيل الدخول) تتطلب توكن JWT في Header:
```
Authorization: Bearer <token>
```

## المسارات

### المصادقة (Auth)

#### POST /api/auth/login
تسجيل الدخول

**Request Body:**
```json
{
  "username": "inquiry",
  "password": "inquiry123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "inquiry",
    "role": "inquiry",
    "name": "موظف الاستعلامات"
  }
}
```

---

### المرضى (Patients)

#### GET /api/patients
الحصول على جميع المرضى (inquiry, doctor)

#### GET /api/patients/:id
الحصول على مريض محدد

#### POST /api/patients
إضافة مريض جديد (inquiry)

**Request Body:**
```json
{
  "name": "أحمد محمد",
  "national_id": "1234567890",
  "phone": "0501234567",
  "age": 30,
  "gender": "ذكر",
  "address": "الرياض"
}
```

#### PUT /api/patients/:id
تعديل بيانات مريض (inquiry)

#### DELETE /api/patients/:id
حذف مريض (inquiry)

---

### الزيارات (Visits)

#### GET /api/visits
الحصول على الزيارات حسب الدور:
- lab: pending_lab
- pharmacist: pending_pharmacy
- doctor: pending_doctor, completed
- inquiry: pending_lab

#### GET /api/visits/:id
الحصول على تفاصيل زيارة كاملة

#### POST /api/visits
إنشاء زيارة جديدة (inquiry)

**Request Body:**
```json
{
  "patient_id": 1
}
```

#### PATCH /api/visits/:id/status
تحديث حالة الزيارة

#### GET /api/visits/patient/:patientId
الحصول على تاريخ زيارات مريض

---

### التحاليل (Lab)

#### GET /api/lab/visit/:visitId
الحصول على نتائج التحاليل لزيارة

#### POST /api/lab
إضافة نتيجة تحليل (lab)

**Request Body:**
```json
{
  "visit_id": 1,
  "test_name": "سكر الدم",
  "result": "95",
  "unit": "mg/dl",
  "normal_range": "70-100 mg/dl",
  "notes": "طبيعي"
}
```

#### PUT /api/lab/:id
تعديل نتيجة تحليل (lab)

#### DELETE /api/lab/:id
حذف نتيجة تحليل (lab)

#### POST /api/lab/complete/:visitId
إكمال التحاليل وإرسال للصيدلي (lab)

---

### الصيدلية (Pharmacy)

#### GET /api/pharmacy/visit/:visitId
الحصول على الأدوية المصروفة لزيارة

#### POST /api/pharmacy
إضافة دواء (pharmacist)

**Request Body:**
```json
{
  "visit_id": 1,
  "medication_name": "باراسيتامول",
  "dosage": "500mg مرتين يومياً",
  "quantity": 2,
  "instructions": "يؤخذ بعد الأكل"
}
```

#### PUT /api/pharmacy/:id
تعديل دواء (pharmacist)

#### DELETE /api/pharmacy/:id
حذف دواء (pharmacist)

#### POST /api/pharmacy/complete/:visitId
صرف العلاج وإرسال للطبيب (pharmacist)

---

### الطبيب (Doctor)

#### GET /api/doctor/search?q=query
البحث عن المرضى بالاسم أو رقم الهوية (doctor)

#### GET /api/doctor/patients/:patientId/visits
الحصول على تاريخ زيارات مريض (doctor)

#### POST /api/doctor/diagnosis
إضافة تشخيص (doctor)

**Request Body:**
```json
{
  "visit_id": 1,
  "diagnosis": "نزلة برد بسيطة",
  "notes": "يُنصح بالراحة وتناول السوائل"
}
```

#### PUT /api/doctor/diagnosis/:id
تعديل تشخيص (doctor)

#### DELETE /api/doctor/diagnosis/:id
حذف تشخيص (doctor)

#### POST /api/doctor/complete/:visitId
إكمال الزيارة (doctor)

---

### التقارير (Reports)

#### GET /api/reports/:visitId
إنشاء تقرير طبي PDF (doctor)

**Response:** PDF File

#### GET /api/reports/:visitId/data
الحصول على بيانات التقرير كـ JSON (doctor)

**Response:**
```json
{
  "visit": {...},
  "lab_results": [...],
  "prescriptions": [...],
  "diagnoses": [...]
}
```

---

## حالات الزيارات (Visit Statuses)

- `pending_lab`: في انتظار التحاليل
- `pending_pharmacy`: في انتظار الصيدلية
- `pending_doctor`: في انتظار الطبيب
- `completed`: مكتملة

## الأخطاء

جميع الأخطاء تعود بالصيغة التالية:
```json
{
  "error": "رسالة الخطأ بالعربية"
}
```

**أكواد الحالة:**
- 200: نجاح
- 201: تم الإنشاء
- 400: خطأ في الطلب
- 401: غير مصرح
- 403: ممنوع الوصول
- 404: غير موجود
- 500: خطأ في الخادم

---

## وحدة الغسل الكلوي (D-IRS) — `/api/dialysis`

> **نطاق المستشفى:** أغلب المسارات تتطلب `hospital_id` (query) — رقم مستشفى واحد، أو القيمة الخاصة `ALL` لدمج كل المستشفيات المسموح بها للمستخدم.  
> **تسمية الحقول:** JSON من الخادم يستخدم `snake_case` في query/body حيث يُذكر أدناه؛ الاستجابات قد تتضمن حقولاً بصيغة camelCase من Prisma/العميل.

### صلاحيات شائعة

| Permission | الاستخدام |
|------------|-----------|
| `dialysis:view` | قراءة مرضى، جلسات، قاعة، تقارير |
| `dialysis:patient:create` | إضافة مريض |
| `dialysis:session:create` / `edit` | جلسات |
| `dialysis:pharmacy:view` | صيدلية الغسل |
| `dialysis:access:manage` | إدارة الوصول + audit log |
| `dialysis:reconciliation` | مطابقة إحصائية |

### مرضى

| Method | Path | ملاحظات |
|--------|------|---------|
| GET | `/api/dialysis/patients` | `hospital_id`, `search`, `face_filter`, `sessions_filter`, `last_session_filter`, `limit`, `offset` |
| GET | `/api/dialysis/patients/lookup` | قائمة مختصرة للقوائم المنسدلة |
| GET | `/api/dialysis/patients/face-stats` | `without_face_count`, `needs_reenroll_count` |
| POST | `/api/dialysis/patients` | إنشاء (طارئ/دائم + `schedules[]`) |
| PATCH | `/api/dialysis/patients/:id` | تعديل |
| DELETE | `/api/dialysis/patients/:id` | يتطلب صلاحية حذف |
| POST | `/api/dialysis/patients/identify-face` | `{ hospital_id, descriptors[] }` — rate limit |
| POST | `/api/dialysis/patients/:id/face-enroll` | تسجيل بصمة |

### جلسات وقاعة

| Method | Path | ملاحظات |
|--------|------|---------|
| GET | `/api/dialysis/sessions` | فلاتر: `status`, `date`, `intake_kind`, `patient_match_method`, `dialysis_patient_id` |
| GET | `/api/dialysis/sessions/active` | الجلسات الجارية (القاعة) |
| GET | `/api/dialysis/sessions/kpis` | `date` — مؤشرات اليوم |
| POST | `/api/dialysis/sessions` | إنشاء جلسة |
| PATCH | `/api/dialysis/sessions/:id` | تحديث (حالة، vitals، …) |
| DELETE | `/api/dialysis/sessions/:id` | حذف مع تأكيد في الواجهة |
| GET | `/api/dialysis/live/stream` | SSE — `?token=` + `hospital_id` |

### وزارة وتدقيق

| Method | Path | ملاحظات |
|--------|------|---------|
| GET | `/api/dialysis/ministry/summary` | KPIs مجمّعة |
| GET | `/api/dialysis/ministry/export.xlsx` | تصدير Excel |
| GET | `/api/dialysis/audit-log` | `dialysis:access:manage` — عمليات حساسة |

### صيدلية الغسل

| Method | Path | ملاحظات |
|--------|------|---------|
| GET | `/api/dialysis/pharmacy/inventory/overview` | KPIs + أصناف |
| GET | `/api/dialysis/pharmacy/dispense-queue` | طابور الصرف |

> للمسارات الكاملة راجع `server/routes/dialysis.js` و `server/routes/dialysis-pharmacy.js`.
