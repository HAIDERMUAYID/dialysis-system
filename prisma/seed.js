const { PrismaClient } = require('@prisma/client');
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

    const visit = await prisma.visit.create({
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
    visits.push(visit);
    console.log(`  ✓ تم إنشاء الزيارة: ${visitNumber} - الحالة: ${status}`);
  }

  // 7. إنشاء نتائج التحاليل (Lab Results)
  console.log('\n🔬 إنشاء نتائج التحاليل...');
  for (let i = 0; i < Math.min(visits.length, 3); i++) {
    const visit = visits[i];
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
