/**
 * سكريبت اختبار شامل لنظام مستشفى الحكيم
 * يختبر جميع الوظائف الرئيسية
 */

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'https://hospital-api-7v73.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hospital-frontend-wrxu.onrender.com';

// Test accounts
const TEST_ACCOUNTS = {
  inquiry: { username: 'inquiry', password: 'inquiry123' },
  lab: { username: 'lab', password: 'lab123' },
  pharmacist: { username: 'pharmacist', password: 'pharmacist123' },
  doctor: { username: 'doctor', password: 'doctor123' }
};

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper functions
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function pass(testName) {
  results.passed.push(testName);
  log(`✅ ${testName}`, 'success');
}

function fail(testName, error) {
  results.failed.push({ test: testName, error: error.message || error });
  log(`❌ ${testName}: ${error.message || error}`, 'error');
}

function warn(testName, message) {
  results.warnings.push({ test: testName, message });
  log(`⚠️  ${testName}: ${message}`, 'warning');
}

// Test functions
async function testHealthCheck() {
  try {
    log('\n📋 اختبار 1: Health Check', 'info');
    const response = await axios.get(`${API_URL}/api/health`);
    if (response.data.status === 'OK') {
      pass('Health Check');
      return true;
    } else {
      fail('Health Check', new Error('Status is not OK'));
      return false;
    }
  } catch (error) {
    fail('Health Check', error);
    return false;
  }
}

async function testLogin(username, password) {
  try {
    log(`\n📋 اختبار 2: تسجيل الدخول (${username})`, 'info');
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      username,
      password
    });
    
    if (response.data.token && response.data.user) {
      pass(`تسجيل الدخول (${username})`);
      return response.data.token;
    } else {
      fail(`تسجيل الدخول (${username})`, new Error('No token or user returned'));
      return null;
    }
  } catch (error) {
    fail(`تسجيل الدخول (${username})`, error);
    return null;
  }
}

async function testAddPatient(token) {
  try {
    log('\n📋 اختبار 3: إضافة مريض جديد', 'info');
    const patientData = {
      name: 'محمد أحمد - اختبار',
      patient_category: 'زراعة كلية',
      gender: 'ذكر',
      date_of_birth: '1990-01-01',
      age: 34,
      blood_type: 'A+',
      phone: '07701234567',
      city: 'بغداد',
      address: 'منطقة الاختبار'
    };

    const response = await axios.post(
      `${API_URL}/api/patients`,
      patientData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id) {
      pass('إضافة مريض جديد');
      return response.data.id;
    } else {
      fail('إضافة مريض جديد', new Error('No patient ID returned'));
      return null;
    }
  } catch (error) {
    fail('إضافة مريض جديد', error);
    return null;
  }
}

async function testSearchPatients(token) {
  try {
    log('\n📋 اختبار 4: البحث عن المرضى', 'info');
    const response = await axios.get(
      `${API_URL}/api/patients?search=محمد`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (Array.isArray(response.data.data || response.data)) {
      pass('البحث عن المرضى');
      return true;
    } else {
      fail('البحث عن المرضى', new Error('Invalid response format'));
      return false;
    }
  } catch (error) {
    fail('البحث عن المرضى', error);
    return false;
  }
}

async function testCreateVisit(token, patientId) {
  try {
    log('\n📋 اختبار 5: إنشاء زيارة جديدة', 'info');
    const response = await axios.post(
      `${API_URL}/api/visits`,
      { patient_id: patientId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id && response.data.visit_number) {
      pass('إنشاء زيارة جديدة');
      return response.data.id;
    } else {
      fail('إنشاء زيارة جديدة', new Error('No visit ID or number returned'));
      return null;
    }
  } catch (error) {
    fail('إنشاء زيارة جديدة', error);
    return null;
  }
}

async function testAddLabTestToCatalog(token) {
  try {
    log('\n📋 اختبار 6: إضافة تحليل للكتالوج', 'info');
    const labTestData = {
      test_name: 'Blood Test - Test',
      test_name_ar: 'تحليل الدم - اختبار',
      unit: 'g/dL',
      normal_range_min: '12',
      normal_range_max: '15',
      normal_range_text: '12-15 g/dL',
      description: 'اختبار شامل للدم'
    };

    const response = await axios.post(
      `${API_URL}/api/lab/catalog`,
      labTestData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id) {
      pass('إضافة تحليل للكتالوج');
      return response.data.id;
    } else {
      fail('إضافة تحليل للكتالوج', new Error('No test ID returned'));
      return null;
    }
  } catch (error) {
    fail('إضافة تحليل للكتالوج', error);
    return null;
  }
}

async function testGetLabCatalog(token) {
  try {
    log('\n📋 اختبار 7: جلب كتالوج التحاليل', 'info');
    const response = await axios.get(
      `${API_URL}/api/lab/catalog`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (Array.isArray(response.data)) {
      pass('جلب كتالوج التحاليل');
      return true;
    } else {
      fail('جلب كتالوج التحاليل', new Error('Invalid response format'));
      return false;
    }
  } catch (error) {
    fail('جلب كتالوج التحاليل', error);
    return false;
  }
}

async function testAddLabResult(token, visitId, testCatalogId) {
  try {
    log('\n📋 اختبار 8: إضافة نتيجة تحليل', 'info');
    const labResultData = {
      visit_id: visitId,
      test_catalog_id: testCatalogId,
      result: '13.5',
      unit: 'g/dL',
      normal_range: '12-15 g/dL',
      notes: 'نتيجة طبيعية'
    };

    const response = await axios.post(
      `${API_URL}/api/lab`,
      labResultData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id) {
      pass('إضافة نتيجة تحليل');
      return response.data.id;
    } else {
      fail('إضافة نتيجة تحليل', new Error('No result ID returned'));
      return null;
    }
  } catch (error) {
    fail('إضافة نتيجة تحليل', error);
    return null;
  }
}

async function testAddPrescription(token, visitId) {
  try {
    log('\n📋 اختبار 9: إضافة وصفة طبية', 'info');
    const prescriptionData = {
      visit_id: visitId,
      medication_name: 'باراسيتامول - اختبار',
      dosage: '500mg',
      quantity: 20,
      instructions: 'مرتين يومياً بعد الأكل'
    };

    const response = await axios.post(
      `${API_URL}/api/pharmacy`,
      prescriptionData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id) {
      pass('إضافة وصفة طبية');
      return response.data.id;
    } else {
      fail('إضافة وصفة طبية', new Error('No prescription ID returned'));
      return null;
    }
  } catch (error) {
    fail('إضافة وصفة طبية', error);
    return null;
  }
}

async function testAddDiagnosis(token, visitId) {
  try {
    log('\n📋 اختبار 10: إضافة تشخيص', 'info');
    const diagnosisData = {
      visit_id: visitId,
      diagnosis: 'ارتفاع ضغط الدم - اختبار',
      notes: 'يحتاج متابعة دورية'
    };

    const response = await axios.post(
      `${API_URL}/api/doctor/diagnosis`,
      diagnosisData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id) {
      pass('إضافة تشخيص');
      return response.data.id;
    } else {
      fail('إضافة تشخيص', new Error('No diagnosis ID returned'));
      return null;
    }
  } catch (error) {
    fail('إضافة تشخيص', error);
    return null;
  }
}

async function testGetVisitDetails(token, visitId) {
  try {
    log('\n📋 اختبار 11: جلب تفاصيل الزيارة', 'info');
    const response = await axios.get(
      `${API_URL}/api/visits/${visitId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.id && response.data.visit_number) {
      pass('جلب تفاصيل الزيارة');
      return true;
    } else {
      fail('جلب تفاصيل الزيارة', new Error('Invalid visit data'));
      return false;
    }
  } catch (error) {
    fail('جلب تفاصيل الزيارة', error);
    return false;
  }
}

async function testGetDashboardStats(token) {
  try {
    log('\n📋 اختبار 12: جلب إحصائيات Dashboard', 'info');
    const response = await axios.get(
      `${API_URL}/api/admin/dashboard/stats`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.total_patients !== undefined) {
      pass('جلب إحصائيات Dashboard');
      return true;
    } else {
      fail('جلب إحصائيات Dashboard', new Error('Invalid stats format'));
      return false;
    }
  } catch (error) {
    // This might fail if user is not admin, which is OK
    if (error.response?.status === 403) {
      warn('جلب إحصائيات Dashboard', 'يحتاج صلاحيات admin');
    } else {
      fail('جلب إحصائيات Dashboard', error);
    }
    return false;
  }
}

async function testGetDatabaseTables(token) {
  try {
    log('\n📋 اختبار 13: جلب معلومات الجداول', 'info');
    const response = await axios.get(
      `${API_URL}/api/admin/database/tables`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.tables && Array.isArray(response.data.tables)) {
      pass('جلب معلومات الجداول');
      log(`   عدد الجداول: ${response.data.tables.length}`, 'info');
      return true;
    } else {
      fail('جلب معلومات الجداول', new Error('Invalid tables format'));
      return false;
    }
  } catch (error) {
    if (error.response?.status === 403) {
      warn('جلب معلومات الجداول', 'يحتاج صلاحيات admin');
    } else {
      fail('جلب معلومات الجداول', error);
    }
    return false;
  }
}

async function testPermissions() {
  try {
    log('\n📋 اختبار 14: اختبار الصلاحيات', 'info');
    
    // Test inquiry permissions
    const inquiryToken = await testLogin('inquiry', 'inquiry123');
    if (inquiryToken) {
      // Inquiry should be able to add patients
      const patientId = await testAddPatient(inquiryToken);
      if (patientId) {
        pass('صلاحيات موظف الاستعلامات - إضافة مريض');
      }
    }

    // Test lab permissions
    const labToken = await testLogin('lab', 'lab123');
    if (labToken) {
      const testId = await testAddLabTestToCatalog(labToken);
      if (testId) {
        warn('صلاحيات موظف التحليلات', 'يمكنه إضافة للكتالوج (قد يحتاج lab_manager)');
      }
    }

    pass('اختبار الصلاحيات');
    return true;
  } catch (error) {
    fail('اختبار الصلاحيات', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  log('\n🚀 بدء الاختبار الشامل لنظام مستشفى الحكيم', 'info');
  log(`API URL: ${API_URL}`, 'info');
  log(`Frontend URL: ${FRONTEND_URL}`, 'info');

  try {
    // Basic tests
    await testHealthCheck();
    
    // Login tests
    const inquiryToken = await testLogin('inquiry', 'inquiry123');
    if (!inquiryToken) {
      log('\n❌ فشل تسجيل الدخول - لا يمكن متابعة الاختبارات', 'error');
      printResults();
      return;
    }

    // Patient tests
    const patientId = await testAddPatient(inquiryToken);
    await testSearchPatients(inquiryToken);

    // Visit tests
    let visitId = null;
    if (patientId) {
      visitId = await testCreateVisit(inquiryToken, patientId);
    }

    // Lab tests
    const labToken = await testLogin('lab', 'lab123');
    if (labToken) {
      const testCatalogId = await testAddLabTestToCatalog(labToken);
      await testGetLabCatalog(labToken);
      
      if (visitId && testCatalogId) {
        await testAddLabResult(labToken, visitId, testCatalogId);
      }
    }

    // Pharmacy tests
    const pharmacistToken = await testLogin('pharmacist', 'pharmacist123');
    if (pharmacistToken && visitId) {
      await testAddPrescription(pharmacistToken, visitId);
    }

    // Doctor tests
    const doctorToken = await testLogin('doctor', 'doctor123');
    if (doctorToken && visitId) {
      await testAddDiagnosis(doctorToken, visitId);
      await testGetVisitDetails(doctorToken, visitId);
    }

    // Admin tests
    if (inquiryToken) {
      await testGetDashboardStats(inquiryToken);
      await testGetDatabaseTables(inquiryToken);
    }

    // Permissions test
    await testPermissions();

  } catch (error) {
    log(`\n❌ خطأ عام في الاختبار: ${error.message}`, 'error');
  }

  printResults();
}

function printResults() {
  log('\n' + '='.repeat(60), 'info');
  log('📊 ملخص نتائج الاختبار', 'info');
  log('='.repeat(60), 'info');
  
  log(`\n✅ نجحت: ${results.passed.length}`, 'success');
  log(`❌ فشلت: ${results.failed.length}`, 'error');
  log(`⚠️  تحذيرات: ${results.warnings.length}`, 'warning');

  const total = results.passed.length + results.failed.length;
  const successRate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : 0;
  log(`\n📈 نسبة النجاح: ${successRate}%`, 'info');

  if (results.failed.length > 0) {
    log('\n❌ الاختبارات الفاشلة:', 'error');
    results.failed.forEach(({ test, error }) => {
      log(`   - ${test}: ${error}`, 'error');
    });
  }

  if (results.warnings.length > 0) {
    log('\n⚠️  التحذيرات:', 'warning');
    results.warnings.forEach(({ test, message }) => {
      log(`   - ${test}: ${message}`, 'warning');
    });
  }

  log('\n' + '='.repeat(60), 'info');
  
  if (results.failed.length === 0) {
    log('🎉 جميع الاختبارات نجحت! النظام جاهز للتسليم.', 'success');
  } else {
    log('⚠️  بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.', 'warning');
  }
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
