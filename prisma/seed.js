const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Load environment variables from prisma/.env or root .env
const envPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
} else {
  require('dotenv').config();
}

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء إضافة البيانات التجريبية...');

  // 1. إنشاء الأدوار (Roles)
  console.log('📋 إنشاء الأدوار...');
  const roles = [
    { name: 'admin', displayName: 'مدير النظام', isSystemRole: 1 },
    /** دور تقني: حسابات تُنشأ من «إدارة وصول الغسيل» فقط — لا وصول تلقائي للنظام الرئيسي */
    {
      name: 'dialysis_staff',
      displayName: 'موظف وحدة الغسيل (D-IRS)',
      isSystemRole: 1,
    },
    { name: 'inquiry', displayName: 'موظف الاستعلامات', isSystemRole: 1 },
    { name: 'lab', displayName: 'موظف التحاليل', isSystemRole: 1 },
    { name: 'lab_manager', displayName: 'مدير المختبر', isSystemRole: 1 },
    { name: 'pharmacist', displayName: 'الصيدلي', isSystemRole: 1 },
    { name: 'pharmacy_manager', displayName: 'مدير الصيدلية', isSystemRole: 1 },
    { name: 'doctor', displayName: 'الطبيب', isSystemRole: 1 },
  ];

  const createdRoles = {};
  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    createdRoles[role.name] = created;
    console.log(`  ✓ تم إنشاء/تحديث الدور: ${role.displayName}`);
  }

  // 1b. صلاحيات D-IRS (فصل دقيق + ربط بالأدوار)
  console.log('\n🔐 صلاحيات الغسل الكلوي (D-IRS)...');
  /** فئة لكل صلاحية — تُستخدم في شاشة إدارة الوصول لتجميع الصفحات والإجراءات (ترتيب أبجدي d01…d08) */
  const dialysisPermDefs = [
    ['d01_overview', 'dialysis:view', 'عرض الوحدة — الدخول لكل الصفحات الأساسية (نظرة عامة، مرضى، جلسات، تقارير، القاعة النشطة، الإعدادات المعروضة)'],
    [
      'd01_overview',
      'dialysis:scope:all_hospitals',
      'متابعة كل مستشفيات الغسيل الكلوي (مديرية الصحة / إشراف مركزي)',
    ],
    ['d02_hospital', 'dialysis:hospital:manage', 'إنشاء وتعديل وتعطيل مستشفيات D-IRS من شريط الوحدة'],
    ['d03_patients', 'dialysis:patient:create', 'إضافة مريض غسيل'],
    ['d03_patients', 'dialysis:patient:edit', 'تعديل ملف مريض غسيل / ترقية من طوارئ'],
    ['d03_patients', 'dialysis:patient:delete', 'حذف مريض غسيل'],
    [
      'd04_structure',
      'dialysis:location:manage',
      'إدارة القاعات والأسرة، الشفتات، الأجهزة، ومستودع المواد (غير صيدلية الغسل)',
    ],
    ['d05_sessions', 'dialysis:session:create', 'إنشاء جلسة غسيل'],
    ['d05_sessions', 'dialysis:session:edit', 'تعديل أو إنهاء جلسة غسيل (يشمل القاعة النشطة)'],
    ['d05_sessions', 'dialysis:session:delete', 'حذف جلسة غسيل'],
    [
      'd06_stats',
      'dialysis:stats:entry',
      'إدخال السجل الإحصائي اليومي (اسم باسم — مصدر ب) من صفحة التقارير',
    ],
    ['d06_stats', 'dialysis:stats:bulk', 'إدخال إحصائي جماعي (مصدر ب)'],
    ['d06_stats', 'dialysis:reconciliation', 'صفحة الإحصاء والمطابقة — مطابقة الميدان مع الإحصاء'],
    ['d07_pharmacy', 'dialysis:pharmacy:view', 'عرض صيدلية الغسل والجلسات المرتبطة بالصرف'],
    ['d07_pharmacy', 'dialysis:pharmacy:dispense', 'صرف علاج مرتبط بجلسة غسيل وخصم مخزون الصيدلية'],
    ['d07_pharmacy', 'dialysis:pharmacy:inventory', 'إدارة مخزن صيدلية وحدة الغسل (وارد وتعديلات)'],
    ['d08_access', 'dialysis:access:manage', 'إدارة وصول المستخدمين والصلاحيات لوحدة الغسيل (هذه الشاشة)'],
  ];
  const dialysisPerms = {};
  for (const [category, name, displayName] of dialysisPermDefs) {
    dialysisPerms[name] = await prisma.permission.upsert({
      where: { name },
      update: { displayName, category },
      create: { name, displayName, category },
    });
  }

  async function linkDialysisPerms(roleKey, permNames) {
    const role = createdRoles[roleKey];
    if (!role) return;
    for (const pname of permNames) {
      const p = dialysisPerms[pname];
      if (!p) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      });
    }
  }

  const ALL_D = Object.keys(dialysisPerms);
  const INQUIRY_D = ALL_D.filter(
    (n) =>
      ![
        'dialysis:patient:delete',
        'dialysis:session:delete',
        'dialysis:hospital:manage',
        'dialysis:scope:all_hospitals',
      ].includes(n)
  );

  await linkDialysisPerms('admin', ALL_D);
  await linkDialysisPerms('inquiry', INQUIRY_D);
  await linkDialysisPerms('doctor', ['dialysis:view', 'dialysis:reconciliation']);
  await linkDialysisPerms('pharmacist', [
    'dialysis:pharmacy:view',
    'dialysis:pharmacy:dispense',
    'dialysis:pharmacy:inventory',
  ]);
  await linkDialysisPerms('pharmacy_manager', [
    'dialysis:pharmacy:view',
    'dialysis:pharmacy:dispense',
    'dialysis:pharmacy:inventory',
  ]);

  console.log(
    '  ✓ تم ربط صلاحيات D-IRS (admin كامل، inquiry بدون حذف، doctor عرض+مطابقة، صيدلية الغسل للصيدلي/مدير الصيدلية)'
  );

  // 2. إنشاء المستخدمين (Users)
  console.log('\n👥 إنشاء المستخدمين...');
  const defaultPassword = await bcrypt.hash('123456', 10); // كلمة مرور افتراضية: 123456
  
  const users = [
    {
      username: 'admin',
      password: defaultPassword,
      role: 'admin',
      roleId: createdRoles['admin'].id,
      name: 'أحمد محمد',
      email: 'admin@hospital.com',
      phone: '0501234567',
      isActive: 1,
    },
    {
      username: 'inquiry',
      password: defaultPassword,
      role: 'inquiry',
      roleId: createdRoles['inquiry'].id,
      name: 'فاطمة علي',
      email: 'inquiry@hospital.com',
      phone: '0501234568',
      isActive: 1,
    },
    {
      username: 'lab',
      password: defaultPassword,
      role: 'lab',
      roleId: createdRoles['lab'].id,
      name: 'خالد حسن',
      email: 'lab@hospital.com',
      phone: '0501234569',
      isActive: 1,
    },
    {
      username: 'lab_manager',
      password: defaultPassword,
      role: 'lab_manager',
      roleId: createdRoles['lab_manager'].id,
      name: 'سارة أحمد',
      email: 'lab_manager@hospital.com',
      phone: '0501234570',
      isActive: 1,
    },
    {
      username: 'pharmacist',
      password: defaultPassword,
      role: 'pharmacist',
      roleId: createdRoles['pharmacist'].id,
      name: 'محمد خالد',
      email: 'pharmacist@hospital.com',
      phone: '0501234571',
      isActive: 1,
    },
    {
      username: 'pharmacy_manager',
      password: defaultPassword,
      role: 'pharmacy_manager',
      roleId: createdRoles['pharmacy_manager'].id,
      name: 'نورا سعيد',
      email: 'pharmacy_manager@hospital.com',
      phone: '0501234572',
      isActive: 1,
    },
    {
      username: 'doctor',
      password: defaultPassword,
      role: 'doctor',
      roleId: createdRoles['doctor'].id,
      name: 'د. علي محمود',
      email: 'doctor@hospital.com',
      phone: '0501234573',
      isActive: 1,
    },
  ];

  const createdUsers = {};
  for (const userData of users) {
    const existing = await prisma.user.findUnique({
      where: { username: userData.username },
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { username: userData.username },
        data: {
          password: userData.password,
          roleId: userData.roleId,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
        },
      });
      createdUsers[userData.username] = updated;
      console.log(`  ✓ تم تحديث المستخدم: ${userData.name}`);
    } else {
      const created = await prisma.user.create({
        data: {
          ...userData,
          createdBy: createdUsers['admin']?.id || null,
        },
      });
      createdUsers[userData.username] = created;
      console.log(`  ✓ تم إنشاء المستخدم: ${userData.name}`);
    }
  }

  // 3. إنشاء كتالوج التحاليل (Lab Tests Catalog)
  console.log('\n🧪 إنشاء كتالوج التحاليل...');
  const labTests = [
    {
      testName: 'CBC',
      testNameAr: 'تحليل الدم الشامل',
      unit: 'count',
      normalRangeMin: '4.5',
      normalRangeMax: '11.0',
      normalRangeText: '4.5-11.0 × 10^9/L',
      description: 'Complete Blood Count - تحليل الدم الشامل',
      isActive: 1,
      createdBy: createdUsers['lab_manager']?.id,
    },
    {
      testName: 'Glucose',
      testNameAr: 'السكر في الدم',
      unit: 'mg/dL',
      normalRangeMin: '70',
      normalRangeMax: '100',
      normalRangeText: '70-100 mg/dL (Fasting)',
      description: 'Blood Glucose Level - مستوى السكر في الدم',
      isActive: 1,
      createdBy: createdUsers['lab_manager']?.id,
    },
    {
      testName: 'Cholesterol',
      testNameAr: 'الكوليسترول',
      unit: 'mg/dL',
      normalRangeMin: '0',
      normalRangeMax: '200',
      normalRangeText: '< 200 mg/dL',
      description: 'Total Cholesterol - الكوليسترول الكلي',
      isActive: 1,
      createdBy: createdUsers['lab_manager']?.id,
    },
    {
      testName: 'Hemoglobin',
      testNameAr: 'الهيموجلوبين',
      unit: 'g/dL',
      normalRangeMin: '12',
      normalRangeMax: '16',
      normalRangeText: '12-16 g/dL (Female), 14-18 g/dL (Male)',
      description: 'Hemoglobin Level - مستوى الهيموجلوبين',
      isActive: 1,
      createdBy: createdUsers['lab_manager']?.id,
    },
    {
      testName: 'Creatinine',
      testNameAr: 'الكرياتينين',
      unit: 'mg/dL',
      normalRangeMin: '0.6',
      normalRangeMax: '1.2',
      normalRangeText: '0.6-1.2 mg/dL',
      description: 'Serum Creatinine - الكرياتينين في الدم',
      isActive: 1,
      createdBy: createdUsers['lab_manager']?.id,
    },
  ];

  const createdLabTests = {};
  for (const test of labTests) {
    const created = await prisma.labTestCatalog.upsert({
      where: { testName: test.testName },
      update: {},
      create: test,
    });
    createdLabTests[test.testName] = created;
    console.log(`  ✓ تم إنشاء/تحديث التحليل: ${test.testNameAr}`);
  }

  // 4. إنشاء كتالوج الأدوية (Drugs Catalog)
  console.log('\n💊 إنشاء كتالوج الأدوية...');
  const drugs = [
    {
      drugName: 'Paracetamol',
      drugNameAr: 'باراسيتامول',
      form: 'Tablet',
      strength: '500mg',
      manufacturer: 'Generic',
      description: 'مسكن للألم وخافض للحرارة',
      isActive: 1,
      createdBy: createdUsers['pharmacy_manager']?.id,
    },
    {
      drugName: 'Amoxicillin',
      drugNameAr: 'أموكسيسيلين',
      form: 'Capsule',
      strength: '500mg',
      manufacturer: 'Generic',
      description: 'مضاد حيوي واسع الطيف',
      isActive: 1,
      createdBy: createdUsers['pharmacy_manager']?.id,
    },
    {
      drugName: 'Ibuprofen',
      drugNameAr: 'آيبوبروفين',
      form: 'Tablet',
      strength: '400mg',
      manufacturer: 'Generic',
      description: 'مضاد للالتهابات ومسكن للألم',
      isActive: 1,
      createdBy: createdUsers['pharmacy_manager']?.id,
    },
    {
      drugName: 'Omeprazole',
      drugNameAr: 'أوميبرازول',
      form: 'Capsule',
      strength: '20mg',
      manufacturer: 'Generic',
      description: 'مثبط لمضخة البروتون لعلاج الحموضة',
      isActive: 1,
      createdBy: createdUsers['pharmacy_manager']?.id,
    },
    {
      drugName: 'Metformin',
      drugNameAr: 'ميتفورمين',
      form: 'Tablet',
      strength: '500mg',
      manufacturer: 'Generic',
      description: 'علاج لمرض السكري من النوع الثاني',
      isActive: 1,
      createdBy: createdUsers['pharmacy_manager']?.id,
    },
  ];

  const createdDrugs = {};
  for (const drug of drugs) {
    const created = await prisma.drugCatalog.upsert({
      where: { drugName: drug.drugName },
      update: {},
      create: drug,
    });
    createdDrugs[drug.drugName] = created;
    console.log(`  ✓ تم إنشاء/تحديث الدواء: ${drug.drugNameAr}`);
  }

  // 5. إنشاء المرضى (Patients)
  console.log('\n🏥 إنشاء المرضى...');
  const patients = [
    {
      name: 'محمد أحمد العلي',
      nationalId: '1234567890',
      phone: '0501111111',
      mobile: '0501111111',
      email: 'mohammed@example.com',
      age: 35,
      dateOfBirth: new Date('1989-01-15'),
      gender: 'male',
      bloodType: 'O+',
      address: 'الرياض، حي النخيل',
      city: 'الرياض',
      patientCategory: 'general',
      medicalHistory: 'لا توجد أمراض مزمنة',
      isActive: 1,
      createdBy: createdUsers['inquiry']?.id,
    },
    {
      name: 'فاطمة سعيد الخالد',
      nationalId: '1234567891',
      phone: '0502222222',
      mobile: '0502222222',
      email: 'fatima@example.com',
      age: 28,
      dateOfBirth: new Date('1996-05-20'),
      gender: 'female',
      bloodType: 'A+',
      address: 'جدة، حي الزهراء',
      city: 'جدة',
      patientCategory: 'general',
      medicalHistory: 'حساسية من البنسلين',
      allergies: 'البنسلين',
      isActive: 1,
      createdBy: createdUsers['inquiry']?.id,
    },
    {
      name: 'خالد محمود النور',
      nationalId: '1234567892',
      phone: '0503333333',
      mobile: '0503333333',
      email: 'khalid@example.com',
      age: 45,
      dateOfBirth: new Date('1979-08-10'),
      gender: 'male',
      bloodType: 'B+',
      address: 'الدمام، حي الفيصلية',
      city: 'الدمام',
      patientCategory: 'general',
      medicalHistory: 'سكري من النوع الثاني',
      chronicDiseases: 'السكري',
      currentMedications: 'ميتفورمين 500mg مرتين يومياً',
      isActive: 1,
      createdBy: createdUsers['inquiry']?.id,
    },
    {
      name: 'نورا علي السالم',
      nationalId: '1234567893',
      phone: '0504444444',
      mobile: '0504444444',
      email: 'nora@example.com',
      age: 32,
      dateOfBirth: new Date('1992-11-25'),
      gender: 'female',
      bloodType: 'AB+',
      address: 'الرياض، حي العليا',
      city: 'الرياض',
      patientCategory: 'general',
      medicalHistory: 'لا توجد',
      isActive: 1,
      createdBy: createdUsers['inquiry']?.id,
    },
    {
      name: 'أحمد حسن المطيري',
      nationalId: '1234567894',
      phone: '0505555555',
      mobile: '0505555555',
      email: 'ahmed@example.com',
      age: 50,
      dateOfBirth: new Date('1974-03-12'),
      gender: 'male',
      bloodType: 'O-',
      address: 'الرياض، حي المطار',
      city: 'الرياض',
      patientCategory: 'general',
      medicalHistory: 'ضغط دم مرتفع',
      chronicDiseases: 'ارتفاع ضغط الدم',
      currentMedications: 'أملوديبين 5mg يومياً',
      isActive: 1,
      createdBy: createdUsers['inquiry']?.id,
    },
  ];

  const createdPatients = [];
  for (const patient of patients) {
    const existing = await prisma.patient.findUnique({
      where: { nationalId: patient.nationalId },
    });

    if (existing) {
      console.log(`  ⚠ تم تخطي المريض (موجود): ${patient.name}`);
      createdPatients.push(existing);
    } else {
      const created = await prisma.patient.create({ data: patient });
      createdPatients.push(created);
      console.log(`  ✓ تم إنشاء المريض: ${patient.name}`);
    }
  }

  // 6. إنشاء الزيارات (Visits)
  console.log('\n📋 إنشاء الزيارات...');
  const visitNumbers = [];
  const visits = [];

  for (let i = 0; i < createdPatients.length; i++) {
    const patient = createdPatients[i];
    const visitNumber = `VIS-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`;
    visitNumbers.push(visitNumber);

    let status = 'pending_inquiry';
    let labCompleted = 0;
    let pharmacyCompleted = 0;
    let doctorCompleted = 0;

    // توزيع حالات مختلفة للزيارات
    if (i === 0) {
      status = 'pending_lab';
    } else if (i === 1) {
      status = 'pending_pharmacy';
      labCompleted = 1;
    } else if (i === 2) {
      status = 'pending_doctor';
      labCompleted = 1;
      pharmacyCompleted = 1;
    } else if (i === 3) {
      status = 'pending_all';
    } else {
      status = 'completed';
      labCompleted = 1;
      pharmacyCompleted = 1;
      doctorCompleted = 1;
    }

    const existingVisit = await prisma.visit.findUnique({
      where: { visitNumber },
    });

    let visit;
    if (existingVisit) {
      visit = existingVisit;
      console.log(`  ⚠ تم تخطي الزيارة (موجودة): ${visitNumber}`);
    } else {
      visit = await prisma.visit.create({
        data: {
          patientId: patient.id,
          visitNumber,
          status,
          labCompleted,
          pharmacyCompleted,
          doctorCompleted,
          createdBy: createdUsers['inquiry']?.id,
        },
      });
      console.log(`  ✓ تم إنشاء الزيارة: ${visitNumber} - الحالة: ${status}`);
    }
    visits.push(visit);
  }

  // 7. إنشاء نتائج التحاليل (Lab Results)
  console.log('\n🔬 إنشاء نتائج التحاليل...');
  for (let i = 0; i < Math.min(visits.length, 3); i++) {
    const visit = visits[i];
    const existingLabs = await prisma.labResult.count({
      where: { visitId: visit.id },
    });
    if (existingLabs > 0) {
      console.log(`  ⚠ تحاليل الزيارة ${visit.visitNumber} موجودة مسبقاً — تخطي`);
      continue;
    }
    if (visit.labCompleted === 1 || visit.status === 'pending_pharmacy' || visit.status === 'pending_doctor' || visit.status === 'completed') {
      const testNames = Object.keys(createdLabTests).slice(0, 3);
      for (const testName of testNames) {
        const test = createdLabTests[testName];
        await prisma.labResult.create({
          data: {
            visitId: visit.id,
            testName: test.testName,
            testCatalogId: test.id,
            result: i === 0 ? '7.5' : i === 1 ? '8.2' : '9.1',
            unit: test.unit,
            normalRange: test.normalRangeText,
            notes: 'النتيجة ضمن المعدل الطبيعي',
            createdBy: createdUsers['lab']?.id,
          },
        });
      }
      console.log(`  ✓ تم إضافة نتائج التحاليل للزيارة: ${visit.visitNumber}`);
    }
  }

  // 8. إنشاء الوصفات الطبية (Prescriptions)
  console.log('\n💉 إنشاء الوصفات الطبية...');
  for (let i = 0; i < Math.min(visits.length, 3); i++) {
    const visit = visits[i];
    const existingRx = await prisma.pharmacyPrescription.count({
      where: { visitId: visit.id },
    });
    if (existingRx > 0) {
      console.log(`  ⚠ وصفات الزيارة ${visit.visitNumber} موجودة مسبقاً — تخطي`);
      continue;
    }
    if (visit.pharmacyCompleted === 1 || visit.status === 'pending_doctor' || visit.status === 'completed') {
      const drugNames = Object.keys(createdDrugs).slice(0, 2);
      for (const drugName of drugNames) {
        const drug = createdDrugs[drugName];
        await prisma.pharmacyPrescription.create({
          data: {
            visitId: visit.id,
            medicationName: drug.drugName,
            drugCatalogId: drug.id,
            dosage: '500mg',
            quantity: 10,
            instructions: 'مرتين يومياً بعد الأكل',
            createdBy: createdUsers['pharmacist']?.id,
          },
        });
      }
      console.log(`  ✓ تم إضافة الوصفات للزيارة: ${visit.visitNumber}`);
    }
  }

  // 9. إنشاء التشخيصات (Diagnoses)
  console.log('\n🩺 إنشاء التشخيصات...');
  const diagnoses = [
    'نزلة برد بسيطة',
    'التهاب في الحلق',
    'صداع نصفي',
    'التهاب معوي',
    'ارتفاع في ضغط الدم',
  ];

  for (let i = 0; i < Math.min(visits.length, 2); i++) {
    const visit = visits[i];
    const existingDx = await prisma.diagnosis.count({
      where: { visitId: visit.id },
    });
    if (existingDx > 0) {
      console.log(`  ⚠ تشخيص الزيارة ${visit.visitNumber} موجود مسبقاً — تخطي`);
      continue;
    }
    if (visit.doctorCompleted === 1 || visit.status === 'completed') {
      await prisma.diagnosis.create({
        data: {
          visitId: visit.id,
          diagnosis: diagnoses[i] || 'فحص روتيني',
          notes: 'يحتاج متابعة دورية',
          createdBy: createdUsers['doctor']?.id,
        },
      });
      console.log(`  ✓ تم إضافة التشخيص للزيارة: ${visit.visitNumber}`);
    }
  }

  // 10. إنشاء سجل الأنشطة (Activity Logs)
  console.log('\n📝 إنشاء سجل الأنشطة...');
  const activities = [
    { action: 'create_patient', entityType: 'patient', details: 'تم إنشاء مريض جديد' },
    { action: 'create_visit', entityType: 'visit', details: 'تم إنشاء زيارة جديدة' },
    { action: 'add_lab_result', entityType: 'lab_result', details: 'تم إضافة نتيجة تحليل' },
    { action: 'add_prescription', entityType: 'prescription', details: 'تم إضافة وصفة طبية' },
    { action: 'add_diagnosis', entityType: 'diagnosis', details: 'تم إضافة تشخيص' },
  ];

  for (const activity of activities) {
    await prisma.activityLog.create({
      data: {
        userId: createdUsers['admin']?.id,
        action: activity.action,
        entityType: activity.entityType,
        details: activity.details,
      },
    });
  }
  console.log('  ✓ تم إنشاء سجل الأنشطة');

  // 11. إنشاء الإشعارات (Notifications)
  console.log('\n🔔 إنشاء الإشعارات...');
  const notifications = [
    {
      userId: createdUsers['lab']?.id,
      title: 'زيارة جديدة تحتاج تحاليل',
      message: 'تم إنشاء زيارة جديدة تحتاج إلى إجراء التحاليل',
      type: 'info',
      isRead: 0,
    },
    {
      userId: createdUsers['pharmacist']?.id,
      title: 'زيارة جديدة تحتاج وصفات',
      message: 'تم إنشاء زيارة جديدة تحتاج إلى وصفات طبية',
      type: 'info',
      isRead: 0,
    },
    {
      userId: createdUsers['doctor']?.id,
      title: 'زيارة جديدة تحتاج تشخيص',
      message: 'تم إنشاء زيارة جديدة تحتاج إلى تشخيص',
      type: 'info',
      isRead: 0,
    },
  ];

  for (const notification of notifications) {
    await prisma.notification.create({ data: notification });
  }
  console.log('  ✓ تم إنشاء الإشعارات');

  // 12. D-IRS — مستشفى تجريبي ومستودعات
  console.log('\n🏥 D-IRS — بيانات أولية...');
  try {
    const adminId = createdUsers['admin']?.id;
    const hospital = await prisma.hospital.upsert({
      where: { code: 'NAJAF-DEMO' },
      update: {},
      create: {
        name: 'قسم الكلى الصناعي — تجريبي (مديرية صحة النجف)',
        code: 'NAJAF-DEMO',
        province: 'النجف',
        directorate: 'مديرية صحة النجف أشرف الدين',
        address: 'العراق — النجف',
        isActive: 1,
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });

    const whCount = await prisma.dialysisWarehouse.count({
      where: { hospitalId: hospital.id },
    });
    if (whCount === 0) {
      await prisma.dialysisWarehouse.createMany({
        data: [
          {
            hospitalId: hospital.id,
            type: 'GENERAL_MEDICAL',
            name: 'مستودع مستلزمات عامة',
            isActive: 1,
            createdByUserId: adminId,
            updatedByUserId: adminId,
          },
          {
            hospitalId: hospital.id,
            type: 'PHARMACY',
            name: 'مستودع صيدلية',
            isActive: 1,
            createdByUserId: adminId,
            updatedByUserId: adminId,
          },
        ],
      });
    }

    if (adminId) {
      await prisma.userHospitalAccess.upsert({
        where: {
          userId_hospitalId: {
            userId: adminId,
            hospitalId: hospital.id,
          },
        },
        update: { isPrimary: 1 },
        create: {
          userId: adminId,
          hospitalId: hospital.id,
          isPrimary: 1,
        },
      });
    }

    const demoDialysisUsernames = ['inquiry', 'doctor', 'pharmacist', 'pharmacy_manager'];
    for (const uname of demoDialysisUsernames) {
      const uid = createdUsers[uname]?.id;
      if (uid) {
        await prisma.userHospitalAccess.upsert({
          where: {
            userId_hospitalId: { userId: uid, hospitalId: hospital.id },
          },
          update: {},
          create: {
            userId: uid,
            hospitalId: hospital.id,
            isPrimary: 1,
          },
        });
      }
    }

    await prisma.dialysisLocation.upsert({
      where: {
        hospitalId_hallName_bedCode: {
          hospitalId: hospital.id,
          hallName: 'القاعة أ',
          bedCode: '1',
        },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        hallName: 'القاعة أ',
        bedCode: '1',
        displayOrder: 1,
        isActive: 1,
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });

    const demoSlots = [
      { weekday: 2, name: 'صباحي 1', sm: 8 * 60, em: 10 * 60, cap: 14 },
      { weekday: 2, name: 'مسائي 1', sm: 14 * 60, em: 16 * 60, cap: 12 },
      { weekday: 6, name: 'صباح السبت', sm: 7 * 60, em: 11 * 60, cap: 20 },
    ];
    for (const s of demoSlots) {
      await prisma.dialysisShiftSlot.upsert({
        where: {
          hospitalId_weekday_name: {
            hospitalId: hospital.id,
            weekday: s.weekday,
            name: s.name,
          },
        },
        update: {},
        create: {
          hospitalId: hospital.id,
          weekday: s.weekday,
          name: s.name,
          startMinutes: s.sm,
          endMinutes: s.em,
          capacityApprox: s.cap,
          displayOrder: 0,
          isActive: 1,
          createdByUserId: adminId,
          updatedByUserId: adminId,
        },
      });
    }

    let item = await prisma.dialysisItem.findFirst({
      where: { hospitalId: hospital.id, sku: 'NEEDLE-DEMO' },
    });
    if (!item) {
      item = await prisma.dialysisItem.create({
        data: {
          hospitalId: hospital.id,
          sku: 'NEEDLE-DEMO',
          name: 'إبر وصل — تجريبي',
          measureKind: 'COUNT',
          baseUnitLabel: 'قطعة',
          isActive: 1,
          createdByUserId: adminId,
          updatedByUserId: adminId,
        },
      });
    }

    await prisma.dialysisItemUnit.upsert({
      where: {
        itemId_unitCode: {
          itemId: item.id,
          unitCode: 'PCS',
        },
      },
      update: {},
      create: {
        itemId: item.id,
        unitCode: 'PCS',
        label: 'قطعة',
        levelOrder: 0,
        multiplierToBase: new Prisma.Decimal(1),
        createdByUserId: adminId,
        updatedByUserId: adminId,
      },
    });

    /** صنف دوائي تجريبي + دفعة في مستودع الصيدلية — لصرف صيدلية الغسل */
    const phWh = await prisma.dialysisWarehouse.findFirst({
      where: { hospitalId: hospital.id, type: 'PHARMACY' },
    });
    const paraDrug = await prisma.drugCatalog.findFirst({
      where: { drugName: 'Paracetamol' },
    });
    if (phWh && paraDrug) {
      let rxItem = await prisma.dialysisItem.findFirst({
        where: { hospitalId: hospital.id, sku: 'RX-PARA-DEMO' },
      });
      if (!rxItem) {
        rxItem = await prisma.dialysisItem.create({
          data: {
            hospitalId: hospital.id,
            sku: 'RX-PARA-DEMO',
            name: paraDrug.drugNameAr || 'باراسيتامول',
            drugCatalogId: paraDrug.id,
            measureKind: 'COUNT',
            baseUnitLabel: 'قرص',
            isActive: 1,
            createdByUserId: adminId,
            updatedByUserId: adminId,
          },
        });
      }
      await prisma.dialysisItemUnit.upsert({
        where: {
          itemId_unitCode: { itemId: rxItem.id, unitCode: 'TAB' },
        },
        update: {},
        create: {
          itemId: rxItem.id,
          unitCode: 'TAB',
          label: 'قرص',
          levelOrder: 0,
          multiplierToBase: new Prisma.Decimal(1),
          createdByUserId: adminId,
          updatedByUserId: adminId,
        },
      });
      const existingRxBatch = await prisma.dialysisInventoryBatch.findFirst({
        where: { hospitalId: hospital.id, warehouseId: phWh.id, itemId: rxItem.id },
      });
      if (!existingRxBatch) {
        const qty = new Prisma.Decimal(500);
        const batch = await prisma.dialysisInventoryBatch.create({
          data: {
            hospitalId: hospital.id,
            warehouseId: phWh.id,
            itemId: rxItem.id,
            lotNumber: 'DEMO-LOT-1',
            quantityRemainingBase: qty,
            receivedAt: new Date(),
            createdByUserId: adminId,
            updatedByUserId: adminId,
          },
        });
        await prisma.dialysisInventoryLedger.create({
          data: {
            hospitalId: hospital.id,
            warehouseId: phWh.id,
            itemId: rxItem.id,
            batchId: batch.id,
            txnType: 'RECEIPT',
            quantityDeltaBase: qty,
            refType: 'inventory_batch',
            refId: batch.id,
            createdByUserId: adminId,
          },
        });
      }
    }

    console.log(`  ✓ D-IRS: مستشفى id=${hospital.id} (رمز NAJAF-DEMO)`);
  } catch (e) {
    console.warn('  ⚠️ تخطي بذور D-IRS:', e.message);
  }

  console.log('\n🔄 مزامنة صلاحيات الغسيل (dialysis:*) من الدور إلى المنح المباشر — للمستخدمين غير المدير...');
  try {
    const nonAdmins = await prisma.user.findMany({
      where: { NOT: { role: 'admin' } },
      include: {
        roleRef: {
          include: { permissions: { include: { permission: true } } },
        },
        directPermissions: { select: { permissionId: true } },
      },
    });
    const toAdd = [];
    const pairSeen = new Set();
    for (const u of nonAdmins) {
      if (!u.roleRef?.permissions?.length) continue;
      const have = new Set(u.directPermissions.map((d) => d.permissionId));
      for (const rp of u.roleRef.permissions) {
        const name = rp.permission.name;
        if (!name.startsWith('dialysis:')) continue;
        if (have.has(rp.permissionId)) continue;
        const pk = `${u.id}:${rp.permissionId}`;
        if (pairSeen.has(pk)) continue;
        pairSeen.add(pk);
        toAdd.push({
          userId: u.id,
          permissionId: rp.permissionId,
          grantedById: null,
        });
        have.add(rp.permissionId);
      }
    }
    if (toAdd.length) {
      await prisma.userPermission.createMany({ data: toAdd, skipDuplicates: true });
    }
    console.log(
      `  ✓ تمت مزامنة ${toAdd.length} منح غسيل مباشر (يُطبَّق في الخادم: صلاحيات الغسيل من الجدول المباشر فقط)`
    );
  } catch (e) {
    console.warn('  ⚠️ تخطي مزامنة صلاحيات الغسيل:', e.message);
  }

  console.log('\n✅ تم إكمال إضافة البيانات التجريبية بنجاح!');
  console.log('\n📌 معلومات الدخول:');
  console.log('   اسم المستخدم: admin');
  console.log('   كلمة المرور: 123456');
  console.log('\n   يمكنك استخدام نفس كلمة المرور (123456) لجميع المستخدمين:');
  console.log('   - admin, inquiry, lab, lab_manager, pharmacist, pharmacy_manager, doctor');
}

main()
  .catch((e) => {
    console.error('❌ خطأ في إضافة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
