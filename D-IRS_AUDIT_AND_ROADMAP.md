# D-IRS — تقرير العيوب، التحسينات، وخارطة الطريق

> **نظام:** D-IRS (Dialysis Information & Records System) — وحدة الغسل الكلوي  
> **تاريخ المراجعة:** 2026-06-14  
> **النطاق:** 14 صفحة، ~60 API، تعرف الوجه، صيدلية، تقارير، إحصاء، صلاحيات  
> **التقييم الحالي:** 7.5/10 — جاهز للميدان مع تحسينات تشغيلية وUX

---

## فهرس المحتويات

1. [الملخص التنفيذي](#1-الملخص-التنفيذي)
2. [ما يعمل بامتياز (لا تكسره)](#2-ما-يعمل-بامتياز-لا-تكسره)
3. [العيوب والأخطاء](#3-العيوب-والأخطاء)
4. [نواقص تجربة المستخدم (UX)](#4-نواقص-تجربة-المستخدم-ux)
5. [نواقص التصميم والواجهات](#5-نواقص-التصميم-والواجهات)
6. [الأمان والصلاحيات](#6-الأمان-والصلاحيات)
7. [الأداء والبنية التقنية](#7-الأداء-والبنية-التقنية)
8. [تعرف الوجه — ملاحظات خاصة](#8-تعرف-الوجه--ملاحظات-خاصة)
9. [خارطة التحسين — الأولويات](#9-خارطة-التحسين--الأولويات)
10. [كيف يصبح D-IRS أفضل نظام](#10-كيف-يصبح-d-irs-أفضل-نظام)
11. [قائمة تحقق اختبار يدوي](#11-قائمة-تحقق-اختبار-يدوي)
12. [نتائج اختبار API](#12-نتائج-اختبار-api)

---

## 1. الملخص التنفيذي

| المحور | التقييم | ملاحظة |
|--------|---------|--------|
| البنية والوظائف | ⭐⭐⭐⭐ | CRUD كامل، multi-hospital، صلاحيات دقيقة |
| تجربة الموبايل | ⭐⭐⭐⭐ | شريط سفلي، FAB، pull-to-refresh، haptic |
| تعرف الوجه | ⭐⭐⭐⭐ | staff mode متقدم — يحتاج اختبار ميداني |
| التقارير والإحصاء | ⭐⭐⭐ | غني لكن ثقيل ومعقد |
| الاستقرار والاختبار | ⭐⭐ | لا اختبارات آلية لقسم الغسل |
| جاهزية الإنتاج | ⭐⭐⭐⭐ | بعد إصلاحات أسبوع 1 |

**الخلاصة:** النظام متكامل وظيفياً. أكبر الفجوات: **تأكيد إنهاء الجلسة**، **رسائل خطأ صامتة**، **غياب الاختبارات**، **اعتماد CDN لنماذج الوجه**، **تعقيد UX في التقارير والإحصاء**.

---

## 2. ما يعمل بامتياز (لا تكسره)

احتفظ بهذه النقاط عند أي تطوير:

- **نطاق المستشفى (Scope):** «جميع المستشفيات» للعرض فقط؛ الإنشاء يتطلب مستشفى واحداً — قرار صحيح.
- **DialysisProvider + localStorage:** استمرارية اختيار المستشفى بين الجلسات.
- **صلاحيات granular:** `dialysis:patient:*`, `dialysis:session:*`, `dialysis:pharmacy:*` — نموذج جيد.
- **حماية API على الخادم:** `requirePermission` / `requireAnyPermission` في `server/routes/dialysis.js`.
- **الموبايل:** `dialysis-mobile-polish.css`، إخفاء الشريط السفلي عند overlays، skeleton loading.
- **تعرف الوجه staff mode:** كاميرا خلفية، لقطتان، `DialysisFaceMatchPicker` للمرشحين المتقاربين.
- **DialysisFaceStatusBanner:** يُظهر من بدون بصمة ومن يحتاج إعادة تسجيل.
- **الملف الطبي:** dossier، timeline، طباعة، غلاف احترافي.
- **PWA:** manifest باسم D-IRS، shortcuts للجلسات والمرضى.
- **Empty states:** نصوص عربية مفيدة («لا توجد شفتات — اضغط إضافة شفت»).
- **Preload نماذج الوجه:** `usePreloadDialysisFaceModels` في الخلفية.

---

## 3. العيوب والأخطاء

### 🔴 حرجة — أصلح قبل التوسع الواسع

| # | العيب | التأثير | الملف / الموقع | الإصلاح المقترح |
|---|-------|---------|----------------|-----------------|
| 1 | **إنهاء الجلسة بدون تأكيد** | ضغط خاطئ ينهي غسلة نشطة | `LivePage.tsx`, `SessionsPage.tsx` | `Modal.confirm` قبل PATCH status=COMPLETED |
| 2 | **أخطاء تحميل صامتة في القاعة** | بيانات قديمة بدون علم المستخدم | `LivePage.tsx` (~سطر 53) | `message.error('تعذر تحديث القاعة')` في catch |
| 3 | **لا اختبارات آلية لـ D-IRS** | أي refactor قد يكسر CRUD | المشروع ككل | E2E: login → patient → session → delete |
| 4 | **نماذج face-api من CDN** | لا يعمل offline / شبكة ضعيفة | `dialysisFaceConfig.ts` | bundle محلي في `public/models/` |
| 5 | **مسارات مفتوحة بصلاحية جزئية** | صيدلي قد يفتح `/dialysis/patients` يدوياً | `App.tsx` PrivateRoute | Route guard per-page أو redirect حسب الدور |

### 🟡 متوسطة — أصلح خلال 2–4 أسابيع

| # | العيب | التفاصيل | الإصلاح |
|---|-------|----------|---------|
| 6 | `ReportsPage.tsx` ~2439 سطر | صيانة صعبة، بطء محتمل | تقسيم: Filters, Table, Charts, Export, Statistics |
| 7 | `DialysisDashboard.tsx` legacy | ~1000+ سطر مكرر غير مستخدم | حذف أو أرشفة — `DialysisApp` هو المصدر |
| 8 | تحذيرات ESLint | `CameraOutlined` غير مستخدم؛ `useMemo`/`useCallback` | إصلاح في SessionsPage, ReportsPage |
| 9 | منطقة زمنية الجلسات | API يرفض وقت بدء «في المستقبل» (UTC) | توحيد timezone Iraq (Asia/Baghdad) في UI وAPI |
| 10 | صفحة «ليس لديك صلاحية» | `<div className="error">` خارج brand D-IRS | صفحة 403 داخل `DialysisAppLayout` |
| 11 | `catch(() => {})` فارغ | أخطاء مخفية | تسجيل + رسالة للمستخدم حيث يلزم |

### 🟢 منخفضة — تحسينات لاحقة

| # | العيب | الإصلاح |
|---|-------|---------|
| 12 | PWA `orientation: portrait-primary` | `any` أو landscape للتابلت |
| 13 | أيقونات PWA كلها `ministry-logo.png` | أيقونات D-IRS مخصصة 192/512 maskable |
| 14 | webpack Critical dependency من face-api | توثيق أو dynamic import |
| 15 | import ordering في face (كان خطأ compile) | التأكد من imports في أعلى الملف |

---

## 4. نواقص تجربة المستخدم (UX)

### 4.1 التعقيد على الموبايل

**المشكلة:**
- صفحة المرضى: بحث + 3 فلاتر (بصمة، جلسات، آخر جلسة).
- صفحة الجلسات: KPIs + فلاتر متعددة + drawer إنشاء طويل.

**التحسين:**
- [ ] طي الفلاتر في «فلاتر متقدمة» (Collapse) — مغلقة افتراضياً.
- [ ] حفظ آخر فلتر في localStorage.
- [ ] chip يُظهر عدد النتائج بعد الفلتر.

### 4.2 الشريط السفلي والتنقل

**المشكلة:**
- 4 عناصر فقط: نظرة عامة | مرضى | جلسات | القاعة.
- الصيدلية والتقارير والإعدادات تحت «المزيد».

**التحسين:**
- [ ] شريط سفلي **ديناميكي حسب الدور** (صيدلي → صيدلية + مخزن).
- [ ] اختصار «جلسة جديدة» من FAB في صفحة الجلسات (موجود) — إضافة FAB للقاعة.
- [ ] breadcrumb في الملف الطبي للعودة السريعة.

### 4.3 نطاق «جميع المستشفيات»

**المشكلة:**
- أزرار «مريض جديد» / «جلسة جديدة» معطّلة دون سبب مرئي حتى الضغط.

**التحسين:**
- [ ] Banner ثابت: «للإضافة اختر مستشفى واحداً من ☰ نطاق العمل».
- [ ] تعطيل FAB مع tooltip ولون باهت + نفس الرسالة.

### 4.4 تأكيد العمليات الحساسة

| العملية | تأكيد حالياً | مطلوب |
|---------|-------------|--------|
| حذف جلسة | ✅ Modal.confirm | — |
| حذف مريض | ✅ Modal.confirm | — |
| إنهاء جلسة (Live) | ❌ | Modal.confirm + اسم المريض |
| إنهاء جلسة (Sessions) | ❌ | نفس الشيء |
| صرف صيدلية نهائي | ✅ Modal.confirm | — |
| حذف قاعة/شفت | ⚠️ varies | توحيد Popconfirm |

### 4.5 صفحة الإحصاء والمطابقة

**المشكلة:**
- إدخال JSON جماعي يتطلب معرفة تقنية.

**التحسين:**
- [ ] استيراد Excel/CSV بدل JSON.
- [ ] نموذج جدولي: اسم + تاريخ + وردية + عدد.
- [ ] معاينة قبل الحفظ الجماعي.
- [ ] تقرير مطابقة PDF جاهز للوزارة.

### 4.6 صفحة إدارة الوصول

**المشكلة:**
- قوية للمشرف التقني، معقدة للمستخدم العادي.

**التحسين:**
- [ ] Wizard 3 خطوات: (1) بيانات الموظف (2) المستشفى (3) الصلاحيات بقوالب جاهزة.
- [ ] قوالب: «ممرض غسيل»، «صيدلي»، «مشرف»، «طبيب مطابقة».
- [ ] شرح كل صلاحية بجملة واحدة (موجود جزئياً في seed).

### 4.7 دور الطبيب (doctor)

**المشكلة:**
- لديه `dialysis:view` + `reconciliation` فقط — يرى overview بلا أزرار إنشاء.

**التحسين:**
- [ ] Redirect تلقائي إلى `/dialysis/statistics` عند الدخول.
- [ ] إخفاء overview/patients/sessions من القائمة لهذا الدور.

---

## 5. نواقص التصميم والواجهات

### 5.1 عدم الاتساق

| العنصر | الحالة | الهدف |
|--------|--------|-------|
| Page headers | بعضها `d-page-header`، بعضها hero | مكوّن `DialysisPageHeader` موحد |
| Inline styles | كثيرة في PharmacyStock, Live, Overview | نقل إلى CSS classes |
| بطاقات KPI | gradients متسقة ✅ | تطبيق نفس النمط على Access وStatistics |
| جداول desktop / cards mobile | جيد | توحيد spacing بين الصفحات |

### 5.2 التقارير

- [ ] فصل tabs: «قائمة» | «مؤشرات» | «تصدير».
- [ ] lazy load للرسوم البيانية.
- [ ] progress bar أثناء PDF export (موجود console.error فقط عند الفشل).

### 5.3 إمكانية الوصول (a11y)

**موجود:** `aria-live` في FaceStatusBanner، `focus-visible` في app.css، `role="listbox"` في hospital picker.

**ناقص:**
- [ ] focus trap في modals الوجه (keyboard=false حالياً — مقصود للكاميرا).
- [ ] contrast check لـ tags رمادية على خلفية فاتحة.
- [ ] labels صريحة لكل Select في فلاتر الموبايل.

### 5.4 صفحة خطأ 403

- [ ] تصميم داخل brand: شعار D-IRS + «ليس لديك صلاحية» + زر العودة للصفحة المسموحة.

---

## 6. الأمان والصلاحيات

### 6.1 ما يعمل

- JWT + permissions على كل endpoint حساس.
- admin bypass في PrivateRoute.
- hospital scope على الخادم (`resolveDialysisDataScope`).
- حذف مريض/جلسة يتطلب صلاحية صريحة.

### 6.2 فجوات

| # | الفجوة | التوصية |
|---|--------|---------|
| 1 | frontend route أوسع من القائمة | guard على مستوى Route أو redirect |
| 2 | patients list يسمح لصلاحيات الصيدلية | مقصود للصرف — راجع هل يُعرض PII زائد |
| 3 | dossier يتطلب `dialysis:view` | ✅ صحيح على API |
| 4 | لا rate limit على identify-face | إضافة throttle لمنع brute force |
| 5 | face embeddings في DB | توثيق GDPR/consent — `faceConsentAt` موجود ✅ |

### 6.3 قوالب صلاحيات مقترحة

| القالب | الصلاحيات |
|--------|-----------|
| ممرض ميداني | view, patient:create/edit, session:create/edit, location:manage (read) |
| مشرف وحدة | كل ما سبق + session:delete, patient:delete, stats |
| صيدلي | pharmacy:view, dispense, inventory |
| طبيب مطابقة | view, reconciliation, stats:entry |
| مدير IT | access:manage, hospital:manage, scope:all_hospitals |

---

## 7. الأداء والبنية التقنية

### 7.1 نقاط ضغط

| المنطقة | المشكلة | الحل |
|---------|---------|------|
| Overview | 6 requests كل 30ث | React Query + staleTime |
| Live | poll 15ث | WebSocket أو SSE للجلسات النشطة |
| Reports | جلب كل الجلسات بالفترة | pagination server-side |
| Patients list | take 500 | infinite scroll + search debounce API |
| Face models | ~5–10 MB CDN | cache + local bundle |
| ReportsPage bundle | ملف ضخم | code splitting per tab |

### 7.2 جودة الكود

- [ ] حذف `DialysisDashboard.tsx` بعد التأكد.
- [ ] استخراج hooks: `useDialysisPatients`, `useDialysisSessions`.
- [ ] TypeScript strict لـ API responses.
- [ ] توحيد snake_case في API (`address_line`) — document في API.md.

### 7.3 المراقبة

- [ ] Sentry للأخطاء frontend (PDF export, face capture).
- [ ] structured logs لـ identify-face (confidence, reason).
- [ ] health check: `/api/dialysis/hospitals` + DB.

---

## 8. تعرف الوجه — ملاحظات خاصة

| البند | الحالة | توصية |
|-------|--------|--------|
| Staff mode (كاميرا خلفية) | ✅ | دليل موظف `DialysisFaceStaffGuide` — إبقاؤه |
| Re-enroll للبصمات القديمة | ✅ | banner + filter «يحتاج تحديث» |
| CDN models | ⚠️ | bundle محلي + Service Worker cache |
| HTTPS | مطلوب للكاميرا | تأكيد في DEPLOY_CHECKLIST |
| Ambiguous match | ✅ MatchPicker | — |
| Liveness في staff | معطّل | صحيح للسرعة |
| Pairwise validation | server `dialysisFaceMatch.js` | — |
| اختبار ميداني | **لم يُكتمل** | checklist: إضاءة، كمامة، توأم، نظارات |

### checklist اختبار الوجه الميداني

```
□ تسجيل مريض جديد — لقطتان — نجاح
□ identify في إنشاء جلسة — auto match
□ identify — ambiguous — اختيار يدوي
□ مريض بدون بصمة — MissingPrompt → enroll inline
□ إعادة enroll بعد pipeline قديم
□ flip camera أمامية/خلفية
□ شبكة بطيئة — preload + loading hint
□ رفض: وجوه متعددة، وجه صغير، إضاءة خلفية
```

---

## 9. خارطة التحسين — الأولويات

### المرحلة 1 — أسبوع 1 (إصلاحات سريعة)

| # | المهمة | الجهد | الأثر |
|---|--------|-------|-------|
| 1.1 | Modal.confirm قبل إنهاء الجلسة | 2h | 🔴 عالي |
| 1.2 | رسالة خطأ في LivePage load | 30m | 🔴 عالي |
| 1.3 | Banner merged scope (patients + sessions) | 2h | 🟡 |
| 1.4 | إصلاح ESLint warnings | 1h | 🟢 |
| 1.5 | صفحة 403 branded | 3h | 🟡 |
| 1.6 | Redirect doctor → statistics | 1h | 🟡 |

### المرحلة 2 — أسبوع 2–3 (UX)

| # | المهمة |
|---|--------|
| 2.1 | فلاتر collapsible على الموبايل |
| 2.2 | شريط سفلي ديناميكي حسب الدور |
| 2.3 | Wizard إضافة موظف في Access |
| 2.4 | توحيد DialysisPageHeader |
| 2.5 | حذف DialysisDashboard.tsx |

### المرحلة 3 — أسبوع 4–6 (بنية وأداء)

| # | المهمة |
|---|--------|
| 3.1 | تقسيم ReportsPage إلى 4–5 ملفات |
| 3.2 | bundle face-api models محلياً |
| 3.3 | pagination تقارير + sessions list |
| 3.4 | React Query للـ data fetching |
| 3.5 | E2E tests (Playwright): CRUD أساسي |

### المرحلة 4 — شهر 2–3 (تميز)

| # | المهمة |
|---|--------|
| 4.1 | WebSocket للقاعة النشطة |
| 4.2 | استيراد Excel للإحصاء |
| 4.3 | dashboard وزارة — KPIs قابلة للتصدير |
| 4.4 | offline PWA للقراءة (patients/sessions cache) |
| 4.5 | audit log لعمليات حساسة (حذف، صرف، enroll) |

---

## 10. كيف يصبح D-IRS أفضل نظام

### 10.1 الرؤية

> **D-IRS = نظام تشغيل وحدة الغسل الكلوي:** من استقبال المريض بالوجه → جلسة → صيدلية → تقرير → مطابقة وزارة — في \< 30 ثانية للممرض، وبدون أوراق.

### 10.2 المبادئ الذهبية

1. **الموبايل أولاً** — 90% الاستخدام من الهاتف في القاعة.
2. **3 نقرات أو أقل** — جلسة جديدة: scan → confirm → start.
3. **لا صمت عند الخطأ** — كل failure = رسالة + إجراء (إعادة المحاولة).
4. **تأكيد قبل irreversible** — إنهاء، حذف، صرف نهائي.
5. **offline-ready** — قراءة على الأقل؛ face models محلية.
6. **صلاحيات بالقوالب** — لا checkboxes خام للمشرف.
7. **اختبار قبل deploy** — E2E + checklist ميداني.

### 10.3 مقارنة مع «أفضل نظام ممكن»

| المعيار | D-IRS الآن | أفضل نظام | الفجوة |
|---------|-----------|-----------|--------|
| وقت إنشاء جلسة | ~60–120ث | \<30ث (face auto) | تحسين UX drawer |
| دقة التعرف | staff thresholds | \>95% ميداني | اختبار + tuning |
| offline | ❌ | قراءة + enroll queue | PWA + local models |
| تقارير وزارة | PDF يدوي | export تلقائي scheduled | automation |
| مطابقة إحصاء | JSON bulk | Excel + dashboard | المرحلة 4 |
| تدريب موظف | نصوص في UI | in-app tour 5 دقائق | onboarding |
| مراقبة | logs | Sentry + alerts | observability |

### 10.4 ميزات تميز مستقبلية (اختيارية)

- [ ] **لوحة TV للقاعة:** شاشة كبيرة تعرض الأسرة النشطة (read-only).
- [ ] **تنبيهات:** مريض لم يحضر جدوله، بصمة ناقصة، مخزون منخفض.
- [ ] **تكامل HL7/FHIR** مع نظام المستشفى الرئيسي.
- [ ] **Barcode/QR** على سوار المريض كبديل للوجه.
- [ ] **Voice hint** بالعربية أثناء enroll («ثبّت الرأس»).
- [ ] **Dark mode** للقاعات ذات الإضاءة المنخفضة.

### 10.5 Definition of Done — «أفضل نظام»

```
✅ E2E tests تمر على CI لكل PR
✅ 0 عمليات حساسة بدون confirm
✅ 0 catch فارغ في مسارات CRUD
✅ face models تعمل بدون إنترنت (بعد أول sync)
✅ صيدلي / ممرض / طبيب — landing مناسب لكل دور
✅ تقرير PDF \< 10 ثوانٍ لـ 500 جلسة
✅ checklist ميداني 100% قبل go-live
✅ توثيق API + دليل موظف PDF بالعربية
```

---

## 11. قائمة تحقق اختبار يدوي

### دخول ونطاق
- [ ] `/dialysis-login` → دخول → `/dialysis`
- [ ] اختيار مستشفى واحد vs «جميع المستشفيات»
- [ ] تغيير النطاق من الموبايل (☰ → نطاق العمل)

### المرضى
- [ ] إضافة مريض طارئ (الحقول الإلزامية)
- [ ] إضافة مريض دائم + جدول غسل
- [ ] تعديل + ترقية EMERGENCY → PERSISTENT
- [ ] حذف مريض (confirm)
- [ ] فلاتر: بصمة، آخر جلسة
- [ ] فتح الملف الطبي + طباعة

### الجلسات
- [ ] إنشاء يدوي + vitals
- [ ] إنشاء بتعرف الوجه
- [ ] enroll inline عند غياب البصمة
- [ ] drawer سريري: vitals + consumables
- [ ] إنهاء جلسة (بعد إضافة confirm)
- [ ] حذف جلسة

### القاعة النشطة
- [ ] عرض جلسات ACTIVE
- [ ] refresh / pull-to-refresh
- [ ] فتح سجل كامل من البطاقة

### الإعداد
- [ ] قاعات + أسرة bulk
- [ ] شفتات
- [ ] أجهزة
- [ ] مستودع + batches

### الصيدلية
- [ ] قائمة جلسات للصرف
- [ ] dispense + complete + خصم مخزون
- [ ] مخزن صيدلية: receipt + ledger

### التقارير والإحصاء
- [ ] تقرير بفترة + فلاتر
- [ ] طباعة + PDF
- [ ] إدخال إحصائي + مطابقة

### الوصول
- [ ] إنشاء مستخدم dialysis_staff
- [ ] منح صلاحيات + ربط مستشفى
- [ ] revoke access

### موبايل + PWA
- [ ] iPhone Safari — كاميرا خلفية
- [ ] Android Chrome
- [ ] Add to Home Screen
- [ ] شبكة بطيئة / offline partial

---

## 12. نتائج اختبار API

**تاريخ:** 2026-06-14 | **بيئة:** localhost:5001 | **مستخدم:** admin

| الاختبار | النتيجة |
|----------|---------|
| POST /api/auth/login | ✅ token + 17 dialysis permissions |
| GET /api/dialysis/hospitals | ✅ 2 مستشفيات |
| GET /api/dialysis/patients?hospital_id=1 | ✅ 6 مرضى |
| GET /api/dialysis/sessions | ✅ 8 جلسات |
| POST patient EMERGENCY (بدون address_line) | ❌ «العنوان» ناقص — صحيح |
| POST patient EMERGENCY (كامل) | ✅ id=7 |
| DELETE patient | ✅ { ok: true } |
| POST session (وقت UTC قديم) | ⚠️ «وقت بدء في المستقبل» — راجع timezone |

**ملاحظة API:** الحقول بصيغة snake_case: `address_line`, `full_name`, `hospital_id`.

---

## ملحق — خريطة الملفات الرئيسية

```
client/src/components/Dialysis/
├── app/
│   ├── DialysisApp.tsx          # Routes
│   ├── DialysisAppLayout.tsx    # Shell + nav
│   ├── dialysisContext.tsx      # Hospital scope
│   └── pages/                   # 14 pages
├── face/                        # Face enroll/identify
├── DialysisPatientIntakePanel.tsx
├── DialysisSessionClinicalDrawer.tsx
└── ...

server/routes/dialysis.js        # Core API
server/routes/dialysis-pharmacy.js
server/utils/dialysisFaceMatch.js
```

---

## سجل التحديثات

| التاريخ | التغيير |
|---------|---------|
| 2026-06-14 | إنشاء التقرير — مراجعة شاملة D-IRS |
| 2026-06-15 | **إعادة الاختبار** — بعد تنفيذ Phases 0–4 (انظر §13) |

---

## 13. إعادة الاختبار — 2026-06-15

> بعد تنفيذ خطة [D-IRS_IMPLEMENTATION_PLAN.md](./D-IRS_IMPLEMENTATION_PLAN.md) (Phases 0–4 مُعلَنة مكتملة).

### 13.1 الملخص التنفيذي

| البند | قبل (2026-06-14) | الآن (2026-06-15) |
|--------|------------------|-------------------|
| **التقييم الإجمالي** | 7.5/10 | **8.5/10** (بعد إصلاح الخادم) |
| **جاهزية الإنتاج** | محدودة | جيدة — يحتاج `npm install` + اختبار ميداني للوجه |
| **الخادم (API)** | يعمل | **كان معطّلاً** بخطأ syntax — أُصلح |
| **بناء الإنتاج (client build)** | — | ✅ ينجح |
| **E2E Playwright** | غير موجود | ❌ 0/8 (overlay أخطاء dev + بيئة) |
| **اختبار API يدوي** | جزئي | ✅ CRUD كامل |

### 13.2 ما تم إنجازه من التقرير السابق ✅

| # | التحسين | الحالة | ملاحظة |
|---|---------|--------|--------|
| 1 | تأكيد إنهاء الجلسة | ✅ | `dialysisConfirmEndSession.ts` — Live + Sessions |
| 2 | رسائل خطأ LivePage | ✅ | `message.error('تعذر تحديث القاعة')` |
| 3 | Banner نطاق merged | ✅ | `DialysisMergedScopeBanner` |
| 4 | صفحة 403 branded | ✅ | `DialysisForbiddenPage` + `DialysisRouteGuard` |
| 5 | Redirect الطبيب | ✅ | `reconciliationLanding` → statistics |
| 6 | Route guard per-page | ✅ | في `DialysisAppLayout` |
| 7 | تقسيم ReportsPage | ✅ | 60 سطر + 19 ملف في `pages/reports/` |
| 8 | نماذج face-api محلية | ✅ | `public/models/face-api/` (6 ملفات) |
| 9 | React Query | ✅ | `useDialysisPatients`, hooks |
| 10 | pagination patients | ✅ | API: `limit` + `offset` |
| 11 | WebSocket للقاعة | ✅ | `useDialysisLiveSync` |
| 12 | audit log | ✅ | `/api/dialysis/audit-log` |
| 13 | PWA icons + orientation | ✅ | `orientation: any`، أيقونات maskable |
| 14 | Dark mode | ✅ | `DialysisThemeProvider` |
| 15 | Excel import إحصاء | ✅ | `StatisticalBulkImportPanel` |
| 16 | لوحة TV | ✅ | `/dialysis/live/tv` |
| 17 | تنبيهات تشغيلية | ✅ | `DialysisOperationalAlerts` |
| 18 | Voice hints | ✅ | `dialysisFaceVoice.ts` |
| 19 | حذف DialysisDashboard legacy | ✅ | محذوف |
| 20 | E2E tests مُعرَّفة | ✅ | 8 اختبارات في `e2e/dialysis/` |

### 13.3 عيوب حرجة مكتشفة في إعادة الاختبار 🔴

| # | العيب | التأثير | الحالة |
|---|-------|---------|--------|
| **R1** | **SyntaxError في `dialysis.js:3824`** — `);` زائدة | **الخادم لا يبدأ** — كل D-IRS معطّل | ✅ **أُصلح** في إعادة الاختبار |
| **R2** | E2E تفشل: webpack overlay يحجب النقر | الاختبارات لا تعكس جودة الإنتاج | ⬜ يحتاج تشغيل على build أو تعطيل overlay |
| **R3** | `@sentry/react` في devDependencies | خطأ TS في dev حتى `npm install` | ⚠️ البناء ينجح بعد install؛ انقل لـ dependencies للـ CI |

### 13.4 نتائج اختبار API (2026-06-15)

```
✅ GET  /api/health                    → OK, database connected
✅ POST /api/auth/login (admin)        → token + permissions
✅ GET  /api/dialysis/hospitals        → 2 مستشفيات
✅ POST /api/dialysis/patients         → id=11 (EMERGENCY)
✅ POST /api/dialysis/sessions         → id=16 ACTIVE (timezone Baghdad — لا رفض مستقبل)
✅ GET  /api/dialysis/audit-log        → 4 entries
✅ DELETE session + patient            → { ok: true }
⚠️ GET  /api/dialysis/patients (pharmacist) → 200 (API يسمح؛ UI يمنع عبر RouteGuard)
```

**ملاحظة pagination:** استخدم `limit` و `offset` وليس `page` / `page_size`.

### 13.5 نتائج E2E Playwright

| الاختبار | النتيجة | السبب |
|----------|---------|-------|
| auth — دخول admin | ❌ | webpack-dev-server overlay يحجب زر الدخول |
| crud — patient → session | ❌ | نفس السبب + يعتمد على UI |
| navigation (6 صفحات) | ❌ | timeout / overlay |

**الإجراء المطلوب:**
```bash
cd client && npm install          # يثبّت @sentry/react
npx playwright install chromium   # متصفحات E2E
npm run build && npx serve -s client/build -l 3000  # اختبار على build نظيف
npm run test:e2e
```

### 13.6 عيوب متبقية (بعد التحسينات) 🟡

| # | العيب | الأولوية |
|---|-------|----------|
| 1 | ESLint: `SessionKpis` غير مستخدم، `removeSession` بدون useCallback | منخفضة |
| 2 | `useDialysisLiveSync` — dependency `hospitalIds` ناقص | منخفضة |
| 3 | حجم bundle كبير (face-api + charts) | متوسطة |
| 4 | الصيدلي يصل لـ API المرضى (200) — قرار أمني | مراجعة |
| 5 | اختبار وجه ميداني — **لم يُنفَّذ** | عالية قبل go-live |
| 6 | Definition of Done §10.5 — E2E green على CI | متوسطة |

### 13.7 مقارنة التقييم

| المحور | 2026-06-14 | 2026-06-15 |
|--------|------------|------------|
| البنية والوظائف | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| UX / موبايل | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| الاستقرار | ⭐⭐ | ⭐⭐⭐⭐ (بعد إصلاح R1) |
| الاختبار الآلي | ⭐ | ⭐⭐ (موجود لكن لا يمر) |
| جاهزية ميدانية | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### 13.8 التوصية النهائية

**النظام تحسّن بشكل كبير** — معظم نقاط التقرير الأول نُفّذت. لكن:

1. **خطأ syntax في الخادم** كان يعطّل النظام بالكامل — تأكد من smoke test قبل أي deploy.
2. **E2E** يجب أن تمر على CI قبل الاعتماد على «100% مكتمل».
3. **اختبار وجه ميداني** لا يزال مطلوباً.
4. نفّذ `npm install` في `client/` على كل بيئة جديدة.

**التقييم المحدّث: 8.5/10** — جاهز للميدان بعد smoke test + E2E green + جولة وجه.

---

*لتنفيذ إصلاحات E2E أو نقل Sentry، اطلب صراحة.*
