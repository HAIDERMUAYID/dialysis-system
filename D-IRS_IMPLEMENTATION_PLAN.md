# D-IRS — خطة تنفيذ التحسينات

> **مرجع:** [D-IRS_AUDIT_AND_ROADMAP.md](./D-IRS_AUDIT_AND_ROADMAP.md)  
> **تاريخ الخطة:** 2026-05-29  
> **المدة الإجمالية المقدّرة:** 10–12 أسبوع (مطوّر واحد بدوام كامل)  
> **الهدف:** الانتقال من 7.5/10 إلى نظام ميداني متماسك مع Definition of Done واضح

---

## فهرس

1. [مبادئ التنفيذ](#1-مبادئ-التنفيذ)
2. [ما اكتمل مسبقاً (Phase 0)](#2-ما-اكتمل-مسبقاً-phase-0)
3. [الجدول الزمني](#3-الجدول-الزمني)
4. [Phase 1 — إصلاحات حرجة (أسبوع 1)](#4-phase-1--إصلاحات-حرجة-أسبوع-1)
5. [Phase 2 — UX وتجربة الموبايل (أسبوع 2–3)](#5-phase-2--ux-وتجربة-الموبايل-أسبوع-23)
6. [Phase 3 — بنية وأداء (أسبوع 4–6)](#6-phase-3--بنية-وأداء-أسبوع-46)
7. [Phase 4 — تميز وتوسع (شهر 2–3)](#7-phase-4--تميز-وتوسع-شهر-23)
8. [مسارات متوازية (أمان، وجه، اختبار)](#8-مسارات-متوازية-أمان-وجه-اختبار)
9. [Definition of Done — لكل مرحلة](#9-definition-of-done--لكل-مرحلة)
10. [المخاطر والتبعيات](#10-المخاطر-والتبعيات)
11. [تتبع التقدم](#11-تتبع-التقدم)

---

## 1. مبادئ التنفيذ

| المبدأ | التطبيق |
|--------|---------|
| **لا تكسر ما يعمل** | كل PR صغير + اختبار يدوي من checklist §11 في التقرير |
| **PRs صغيرة** | مهمة واحدة = PR واحد (≤400 سطر diff حيث أمكن) |
| **موبايل أولاً** | أي UX جديد يُختبر على iPhone Safari + Android Chrome |
| **لا صمت عند الخطأ** | كل `catch` في مسارات CRUD = رسالة أو log منظّم |
| **تأكيد قبل irreversible** | إنهاء، حذف، صرف نهائي، promote |
| **تحديث التقرير** | بعد كل phase: تحديث حالة المهام في هذا الملف |

**ترتيب الأولوية:** أمان/استقرار → UX حرج → أداء → تميز.

---

## 2. ما اكتمل مسبقاً (Phase 0)

| ID | المهمة | الملفات | الحالة |
|----|--------|---------|--------|
| 0.1 | حفظ جدول أيام الغسل قبل PATCH المريض | `DialysisPatientDetailModal.tsx` | ✅ |
| 0.2 | الكاميرا الأمامية + الخلفية في تعرف الوجه | `useDialysisFaceCamera.ts`, `dialysisFaceConfig.ts`, `dialysisFaceMatch.js` | ✅ |
| 0.3 | إخفاء الكاميرا عند النتائج + زر إعادة الالتقاط | `DialysisFaceIdentifyModal.tsx` | ✅ |
| 0.4 | إعادة التسجيل لا تعتمد على نوع الكاميرا | `dialysisFaceMatch.js` | ✅ |

> **ملاحظة:** حدّث [D-IRS_AUDIT_AND_ROADMAP.md §8](./D-IRS_AUDIT_AND_ROADMAP.md) ليعكس 0.2–0.4.

---

## 3. الجدول الزمني

```
أسبوع 1   │ Phase 1 — حرج (confirm، أخطاء، 403، ESLint)
أسبوع 2–3 │ Phase 2 — UX (فلاتر، nav، wizard، headers)
أسبوع 4–6 │ Phase 3 — بنية (Reports split، models، pagination، React Query، E2E)
شهر 2–3   │ Phase 4 — تميز (WebSocket، Excel، offline، audit log)
مستمر     │ مسارات §8 (أمان، اختبار ميداني للوجه، Sentry)
```

**Go-live مقترح بعد Phase 1 + checklist §11 + اختبار وجه ميداني.**

---

## 4. Phase 1 — إصلاحات حرجة (أسبوع 1)

**الهدف:** 0 عمليات حساسة بدون confirm، 0 أخطاء صامتة في المسارات الرئيسية.

| ID | المهمة | الجهد | الملفات | معايير القبول | حالة |
|----|--------|-------|---------|---------------|------|
| **1.1** | تأكيد إنهاء الجلسة | 2h | `LivePage.tsx`, `SessionsPage.tsx` | `Modal.confirm` يعرض اسم المريض؛ إلغاء = لا PATCH؛ تأكيد = status COMPLETED | ✅ |
| **1.2** | رسالة خطأ LivePage | 30m | `LivePage.tsx` | فشل poll/load → `message.error('تعذر تحديث القاعة')` | ✅ |
| **1.3** | Banner نطاق «جميع المستشفيات» | 2h | `PatientsPage`, `SessionsPage`, `DialysisMergedScopeBanner` | Banner عند `ALL_MY_HOSPITALS` | ✅ |
| **1.4** | إصلاح ESLint | 1h | `SessionsPage`, `ReportsPage` | build بدون errors | ✅ |
| **1.5** | صفحة 403 branded | 3h | `DialysisForbiddenPage`, `DialysisRouteGuard` | 403 داخل shell D-IRS | ✅ |
| **1.6** | Redirect دور الطبيب | 1h | `DialysisApp`, `dialysisRouteAccess` | reconciliation → statistics | ✅ |
| **1.7** | Route guard per-page | 4h | `DialysisRouteGuard`, `dialysisRouteAccess` | صيدلي → 403 على patients | ✅ |
| **1.8** | مراجعة `catch` فارغ | 2h | `LivePage.tsx` | رسالة عند فشل poll | ✅ |

**إجمالي Phase 1:** ~15.5 ساعة (~2 يوم عمل)

### تسلسل تنفيذ Phase 1

```
1.1 → 1.2 (سريع، تأثير مباشر)
1.5 + 1.6 + 1.7 (صلاحيات — معاً)
1.3 (banner — مستقل)
1.4 + 1.8 (تنظيف — نهاية الأسبوع)
```

### اختبار Phase 1

- [ ] إنهاء جلسة من Live — confirm يظهر
- [ ] إنهاء من Sessions — confirm يظمر
- [ ] قطع API أثناء Live — رسالة خطأ
- [ ] merged scope — banner + FAB معطّل
- [ ] دخول `/dialysis/patients` بصلاحية صيدلي فقط — 403 branded
- [ ] دخول doctor — redirect statistics

---

## 5. Phase 2 — UX وتجربة الموبايل (أسبوع 2–3)

**الهدف:** تقليل التعقيد على الموبايل؛ landing مناسب لكل دور.

| ID | المهمة | الجهد | التفاصيل | معايير القبول | حالة |
|----|--------|-------|----------|---------------|------|
| **2.1** | فلاتر collapsible | 4h | `PatientsPage.tsx` | Collapse «فلاتر متقدمة» مغلق افتراضياً؛ chip عدد النتائج | ✅ |
| **2.2** | حفظ فلاتر localStorage | 2h | `PatientsPage`, `SessionsPage` | استعادة آخر فلتر عند العودة | ✅ |
| **2.3** | شريط سفلي ديناميكي | 6h | `DialysisAppLayout.tsx` | صيدلي: صيدلية+مخزن؛ ممرض: overview+patients+sessions+live | ✅ |
| **2.4** | FAB للقاعة النشطة | 2h | `LivePage.tsx` | refresh سريع أو فلتر — حسب احتياج الميدان | ✅ |
| **2.5** | breadcrumb الملف الطبي | 3h | `PatientMedicalRecordPage.tsx` | مسار: مرضى › اسم › سجل | ✅ |
| **2.6** | Wizard إضافة موظف | 8h | `AccessPage.tsx` | 3 خطوات + قوالب صلاحيات | ✅ |
| **2.7** | `DialysisPageHeader` موحد | 4h | مكوّن جديد + 14 صفحة | عنوان + وصف + actions slot | ✅ (10 صفحات؛ 3 بـ hero مخصص: صيدلية، مخزن، ملف طبي) |
| **2.8** | توحيد Popconfirm حذف | 3h | Halls, Shifts, Machines panels | نفس نص التأكيد ونفس UX | ✅ |
| **2.9** | timezone Asia/Baghdad | 6h | `SessionsPage`, API `dialysis.js` | لا رفض «مستقبل» لجلسة محلية صحيحة | ✅ |
| **2.10** | حذف `DialysisDashboard.tsx` legacy | 2h | بعد grep للمراجع | build ينجح؛ لا imports متبقية | ✅ |

**إجمالي Phase 2:** ~40 ساعة (~1 أسبوع)

### تسلسل Phase 2

```
أسبوع 2: 2.1, 2.2, 2.3, 2.7 (UX مرئي)
أسبوع 3: 2.6, 2.9, 2.8, 2.10 (أعمق + تنظيف)
```

---

## 6. Phase 3 — بنية وأداء (أسبوع 4–6)

**الهدف:** صيانة أسهل؛ تحميل أسرع؛ اختبارات آلية أساسية.

| ID | المهمة | الجهد | التفاصيل | معايير القبول | حالة |
|----|--------|-------|----------|---------------|------|
| **3.1** | تقسيم ReportsPage | 16h | `ReportsFilters`, `ReportsTable`, `ReportsCharts`, `ReportsExport`, `ReportsStatistics` | الملف الرئيسي <300 سطر؛ lazy tabs | ✅ |
| **3.2** | bundle face-api محلي | 6h | `public/models/`, `dialysisFaceConfig.ts`, SW cache | يعمل بدون CDN بعد أول sync | ✅ |
| **3.3** | pagination تقارير | 8h | API + `ReportsPage` | server-side؛ PDF ≤10s لـ500 جلسة | ✅ |
| **3.4** | pagination patients | 6h | API + `PatientsPage` | infinite scroll + debounce search | ✅ |
| **3.5** | React Query | 12h | `useDialysisPatients`, `useDialysisSessions`, Overview | staleTime 30s؛ أقل requests مكررة | ✅ |
| **3.6** | hooks مشتركة | 8h | استخراج من pages | DRY؛ types للـ API responses | ✅ |
| **3.7** | E2E Playwright | 16h | `e2e/dialysis/` | login → patient → session → delete على CI | ✅ (8 tests green) |
| **3.8** | inline styles → CSS | 8h | PharmacyStock, Live, Overview | classes في `dialysis-*.css` | ✅ |
| **3.9** | PDF export progress | 4h | `ReportsPage` | progress bar + message.error واضح | ✅ |

**إجمالي Phase 3:** ~84 ساعة (~2–3 أسابيع)

### تسلسل Phase 3

```
أسبوع 4: 3.2 (face offline) + 3.7 setup E2E
أسبوع 5: 3.1 Reports split + 3.3 pagination
أسبوع 6: 3.5 React Query + 3.7 tests كاملة
```

---

## 7. Phase 4 — تميز وتوسع (شهر 2–3)

**الهدف:** تميز تشغيلي؛ جاهزية وزارة؛ offline جزئي.

| ID | المهمة | الجهد | معايير القبول | حالة |
|----|--------|-------|---------------|------|
| **4.1** | WebSocket / SSE للقاعة | 24h | Live يتحدث فوراً بدون poll 15s | ✅ |
| **4.2** | استيراد Excel للإحصاء | 16h | CSV/Excel بدل JSON؛ معاينة قبل حفظ | ✅ |
| **4.3** | dashboard وزارة + export | 12h | KPIs مجمّعة + PDF scheduled | ✅ |
| **4.4** | offline PWA قراءة | 20h | cache patients/sessions؛ queue enroll | ✅ |
| **4.5** | audit log | 16h | حذف، صرف، enroll، promote | ✅ |
| **4.6** | Sentry + structured logs | 8h | face identify reasons؛ PDF failures | ✅ |
| **4.7** | rate limit identify-face | 4h | throttle per IP/user | ✅ |
| **4.8** | in-app tour (5 دقائق) | 12h | onboarding للممرض | ✅ |
| **4.9** | PWA icons + orientation | 4h | maskable 192/512؛ `orientation: any` | ✅ |
| **4.10** | a11y: labels + contrast | 8h | فلاتر موبايل؛ tags contrast | ✅ |

**اختياري (backlog):**

- [x] لوحة TV للقاعة — `/dialysis/live/tv` (read-only، ملء شاشة، تحديث فوري)
- [x] تنبيهات تشغيلية — بصمة ناقصة، تحديث بصمة، دفعات تنتهي قريباً (`DialysisOperationalAlerts`)
- [x] Voice hint عربي — `speechSynthesis` أثناء enroll/identify + زر كتم
- [x] Dark mode — فاتح / داكن / تلقائي من قائمة الحساب (`DialysisThemeProvider`)
- HL7/FHIR
- Barcode/QR بديل للوجه

---

## 8. مسارات متوازية (أمان، وجه، اختبار)

تُنفَّذ alongside أي phase:

### 8.1 تعرف الوجه — اختبار ميداني

| خطوة | المسؤول | موعد |
|------|---------|------|
| checklist §8 في التقرير (10 سيناريوهات) | فريق الميدان | بعد Phase 1 |
| tuning thresholds إن لزم | dev | +1–2 يوم بعد الميدان |
| توثيق consent/GDPR | admin | قبل go-live |

### 8.2 الأمان

| ID | المهمة | Phase |
|----|--------|-------|
| S.1 | Route guards (1.7) | 1 |
| S.2 | rate limit identify | 4 |
| S.3 | مراجعة PII لصلاحية الصيدلية | 2 |
| S.4 | API.md توثيق snake_case | 3 | ✅ |

### 8.3 الاختبار

| نوع | متى | ماذا |
|-----|-----|------|
| يدوي checklist §11 | نهاية كل phase | CRUD كامل |
| E2E | Phase 3 | CI على PR |
| ميداني وجه | قبل go-live | 10 سيناريوهات |
| load test Reports | Phase 3 | 500+ sessions |

---

## 9. Definition of Done — لكل مرحلة

### Phase 1 Done عندما:

- [ ] 0 إنهاء جلسة بدون confirm
- [ ] 0 catch فارغ في Live/Sessions/Patients save
- [ ] 403 branded يعمل
- [ ] doctor redirect يعمل
- [ ] checklist §11 (دخول، مرضى، جلسات، live) = 100%

### Phase 2 Done عندما:

- [x] فلاتر موبايل collapsible
- [x] nav ديناميكي لـ3 أدوار على الأقل
- [x] Wizard access + 3 قوالب
- [x] timezone Baghdad — لا false «مستقبل»
- [x] `DialysisPageHeader` على الصفحات القياسية (3 صفحات بـ hero مخصص مقصود)

### Phase 3 Done عندما:

- [ ] ReportsPage <5 ملفات
- [ ] face models offline
- [ ] E2E green على CI
- [ ] PDF 500 sessions <10s

### Phase 4 Done عندما:

- [x] Excel import إحصاء
- [x] audit log للعمليات الحساسة
- [x] Sentry يستقبل أخطاء production (عند تعيين REACT_APP_SENTRY_DSN)
- [x] جولة تعريفية in-app للممرض (~5 دقائق)
- [x] a11y: aria-label على فلاتر الموبايل + تباين الوسوم الرمادية

**Phase 4 مكتملة 100%** — المتبقي في backlog اختياري (لوحة TV، تنبيهات، HL7، إلخ).

### «أفضل نظام» (من التقرير §10.5):

```
✅ E2E على CI
✅ 0 irreversible بدون confirm
✅ 0 catch فارغ CRUD
✅ face offline
✅ landing لكل دور
✅ checklist ميداني 100%
✅ API.md + دليل موظف PDF
```

---

## 10. المخاطر والتبعيات

| المخاطر | الاحتمال | التخفيف |
|---------|----------|---------|
| تقسيم ReportsPage يكسر export PDF | متوسط | E2E + snapshot PDF قبل/بafter |
| face models bundle يزيد حجم PWA | منخفض | lazy load + SW cache |
| WebSocket غير متاح على Render | متوسط | SSE fallback أو poll محسّن |
| اختبار ميداني يكشف thresholds خاطئة | عالي | buffer 2 يوم بعد Phase 1 |
| multi-hospital edge cases | متوسط | اختبار `ALL_MY_HOSPITALS` في كل feature |

**تبعيات حرجة:**

- 1.7 يعتمد على 1.5 (403 page)
- 3.1 يفضّل قبل 3.3 (pagination reports)
- 4.4 offline يعتمد على 3.2 (local models)

---

## 11. تتبع التقدم

### ملخص الحالة

| Phase | المهام | مكتمل | % |
|-------|--------|-------|---|
| 0 | 4 | 4 | 100% |
| 1 | 8 | 8 | 100% |
| 2 | 10 | 10 | 100% |
| 3 | 9 | 9 | 100% |
| 4 | 10 | 10 | 100% |

### كيف تُحدَّث هذه الخطة

1. غيّر ⬜ → ✅ عند إنجاز المهمة.
2. أضف PR link في commit message أو هنا.
3. حدّث `D-IRS_AUDIT_AND_ROADMAP.md` §سجل التحديثات.

### أوامر Cursor المقترحة للتنفيذ

```
«نفّذ Phase 1.1 و 1.2 من D-IRS_IMPLEMENTATION_PLAN.md»
«نفّذ Phase 1 كاملة»
«نفّذ 2.1 فلاتر collapsible للمرضى»
«حدّث تتبع التقدم في IMPLEMENTATION_PLAN بعد PR #X»
```

---

## ملحق — تقدير الموارد

| السيناريو | المدة | ملاحظة |
|-----------|-------|--------|
| مطوّر واحد FT | 10–12 أسبوع | كل phases |
| مطوّر واحد + Phase 1 فقط | 1 أسبوع | go-live محدود |
| فريق 2 (FE + BE) | 6–8 أسابيع | Phase 3–4 أسرع |
| Phase 1 + ميدان وجه | 2 أسبوع | موصى به قبل توسع |

---

*آخر تحديث: 2026-05-29 — Phase 4 مكتمل (10/10) + backlog: TV + تنبيهات.*
