const bcrypt = require('bcryptjs');
const path = require('path');

// Support SQLite, MySQL, and Prisma (Supabase/PostgreSQL)
const DB_TYPE = process.env.DB_TYPE || 'sqlite';
let db = null;

const init = async () => {
  if (DB_TYPE === 'prisma' || process.env.DATABASE_URL) {
    // Use Prisma (Supabase/PostgreSQL)
    const prismaDb = require('./db-prisma');
    await prismaDb.init();
    db = prismaDb;
    return;
  } else if (DB_TYPE === 'mysql') {
    // Use MySQL
    const mysqlDb = require('./db-mysql');
    await mysqlDb.init();
    db = mysqlDb;
    return;
  } else {
    // Use SQLite (default)
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, '../../database.sqlite');
    
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          createTables().then(resolve).catch(reject);
        }
      });
    });
  }
};

const createTables = async () => {
  // Create roles table (for custom roles)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      is_system_role INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create permissions table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create role_permissions table (many-to-many)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE(role_id, permission_id)
    )
  `);

  // Create users table (enhanced)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      role_id INTEGER,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create patients table (Enhanced with comprehensive fields)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      national_id TEXT UNIQUE,
      phone TEXT,
      mobile TEXT,
      email TEXT,
      age INTEGER,
      date_of_birth DATE,
      gender TEXT,
      blood_type TEXT,
      address TEXT,
      city TEXT,
      patient_category TEXT,
      medical_history TEXT,
      allergies TEXT,
      chronic_diseases TEXT,
      current_medications TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      insurance_number TEXT,
      insurance_type TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Migrate existing patients table to add new columns
  try {
    const tableInfo = await allQuery("PRAGMA table_info(patients)");
    const columnNames = tableInfo.map(col => col.name);
    
    const newColumns = [
      { name: 'mobile', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'date_of_birth', type: 'DATE' },
      { name: 'blood_type', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'patient_category', type: 'TEXT' },
      { name: 'medical_history', type: 'TEXT' },
      { name: 'allergies', type: 'TEXT' },
      { name: 'chronic_diseases', type: 'TEXT' },
      { name: 'current_medications', type: 'TEXT' },
      { name: 'emergency_contact_name', type: 'TEXT' },
      { name: 'emergency_contact_phone', type: 'TEXT' },
      { name: 'emergency_contact_relation', type: 'TEXT' },
      { name: 'insurance_number', type: 'TEXT' },
      { name: 'insurance_type', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'is_active', type: 'INTEGER DEFAULT 1' },
      { name: 'created_by', type: 'INTEGER' }
    ];

    for (const col of newColumns) {
      if (!columnNames.includes(col.name)) {
        await runQuery(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added ${col.name} column to patients table`);
      }
    }
  } catch (error) {
    console.warn('Migration warning for patients table:', error.message);
  }

  // Create visits table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      visit_number TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending_inquiry',
      lab_completed INTEGER DEFAULT 0,
      pharmacy_completed INTEGER DEFAULT 0,
      doctor_completed INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Migrate existing visits table to add new columns (for existing databases)
  try {
    const tableInfo = await allQuery("PRAGMA table_info(visits)");
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('lab_completed')) {
      await runQuery('ALTER TABLE visits ADD COLUMN lab_completed INTEGER DEFAULT 0');
      console.log('Added lab_completed column to visits table');
    }
    if (!columnNames.includes('pharmacy_completed')) {
      await runQuery('ALTER TABLE visits ADD COLUMN pharmacy_completed INTEGER DEFAULT 0');
      console.log('Added pharmacy_completed column to visits table');
    }
    if (!columnNames.includes('doctor_completed')) {
      await runQuery('ALTER TABLE visits ADD COLUMN doctor_completed INTEGER DEFAULT 0');
      console.log('Added doctor_completed column to visits table');
    }
    
    // Migrate old status values to new system (only if status is old format)
    await runQuery(`UPDATE visits SET status = 'pending_all', lab_completed = 0, pharmacy_completed = 0, doctor_completed = 0 
                    WHERE status = 'pending_lab' AND (lab_completed = 0 OR lab_completed IS NULL)`);
    await runQuery(`UPDATE visits SET status = 'pending_all', pharmacy_completed = 0 
                    WHERE status = 'pending_pharmacy' AND (pharmacy_completed = 0 OR pharmacy_completed IS NULL)`);
    await runQuery(`UPDATE visits SET status = 'pending_all', doctor_completed = 0 
                    WHERE status = 'pending_doctor' AND (doctor_completed = 0 OR doctor_completed IS NULL)`);
  } catch (error) {
    console.warn('Migration warning (can be ignored if columns already exist):', error.message);
  }

  // Create lab_tests_catalog table (Master List of Lab Tests)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS lab_tests_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_name TEXT UNIQUE NOT NULL,
      test_name_ar TEXT,
      unit TEXT NOT NULL,
      normal_range_min TEXT,
      normal_range_max TEXT,
      normal_range_text TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create lab_test_panels table (Groups of Lab Tests)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS lab_test_panels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      panel_name TEXT NOT NULL,
      panel_name_ar TEXT,
      description TEXT,
      created_by INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create lab_test_panel_items table (Tests in each Panel)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS lab_test_panel_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      panel_id INTEGER NOT NULL,
      test_catalog_id INTEGER NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (panel_id) REFERENCES lab_test_panels(id) ON DELETE CASCADE,
      FOREIGN KEY (test_catalog_id) REFERENCES lab_tests_catalog(id) ON DELETE CASCADE,
      UNIQUE(panel_id, test_catalog_id)
    )
  `);

  // Create lab_results table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS lab_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      test_name TEXT NOT NULL,
      test_catalog_id INTEGER,
      result TEXT,
      unit TEXT,
      normal_range TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (test_catalog_id) REFERENCES lab_tests_catalog(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Migrate existing lab_results table
  try {
    const tableInfo = await allQuery("PRAGMA table_info(lab_results)");
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('created_by')) {
      await runQuery('ALTER TABLE lab_results ADD COLUMN created_by INTEGER');
      await runQuery('ALTER TABLE lab_results ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    
    if (!columnNames.includes('test_catalog_id')) {
      await runQuery('ALTER TABLE lab_results ADD COLUMN test_catalog_id INTEGER');
    }
  } catch (error) {
    console.warn('Migration warning for lab_results:', error.message);
  }

  // Create drugs_catalog table (Master List of Drugs)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS drugs_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_name TEXT UNIQUE NOT NULL,
      drug_name_ar TEXT,
      form TEXT,
      strength TEXT,
      manufacturer TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create prescription_sets table (Groups of Prescriptions)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS prescription_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_name TEXT NOT NULL,
      set_name_ar TEXT,
      description TEXT,
      created_by INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create prescription_set_items table (Drugs in each Set)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS prescription_set_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL,
      drug_catalog_id INTEGER NOT NULL,
      default_dosage TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (set_id) REFERENCES prescription_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (drug_catalog_id) REFERENCES drugs_catalog(id) ON DELETE CASCADE,
      UNIQUE(set_id, drug_catalog_id)
    )
  `);

  // Create pharmacy_prescriptions table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      medication_name TEXT NOT NULL,
      drug_catalog_id INTEGER,
      dosage TEXT,
      quantity INTEGER,
      instructions TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (drug_catalog_id) REFERENCES drugs_catalog(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Migrate existing pharmacy_prescriptions table
  try {
    const tableInfo = await allQuery("PRAGMA table_info(pharmacy_prescriptions)");
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('created_by')) {
      await runQuery('ALTER TABLE pharmacy_prescriptions ADD COLUMN created_by INTEGER');
      await runQuery('ALTER TABLE pharmacy_prescriptions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
    
    if (!columnNames.includes('drug_catalog_id')) {
      await runQuery('ALTER TABLE pharmacy_prescriptions ADD COLUMN drug_catalog_id INTEGER');
    }
  } catch (error) {
    console.warn('Migration warning for pharmacy_prescriptions:', error.message);
  }

  // Create diagnoses table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS diagnoses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      diagnosis TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Migrate existing diagnoses table
  try {
    const tableInfo = await allQuery("PRAGMA table_info(diagnoses)");
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('updated_at')) {
      await runQuery('ALTER TABLE diagnoses ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
    }
  } catch (error) {
    console.warn('Migration warning for diagnoses:', error.message);
  }

  // Create visit_status_history table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS visit_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      changed_by INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    )
  `);

  // Create notifications table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER,
      from_user_id INTEGER,
      to_user_id INTEGER,
      to_role TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    )
  `);

  // Create activity_log table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create system_settings table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create user_sessions table (for session management)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create audit_log table (enhanced activity log)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create workflows table (Enterprise Workflow Management)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      workflow_type TEXT NOT NULL,
      initiator_id INTEGER,
      status TEXT DEFAULT 'active',
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (initiator_id) REFERENCES users(id)
    )
  `);

  // Create workflow_templates table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_type TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create workflow_steps table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      assigned_to_role TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      requires_approval INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create workflow_instances table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL,
      step_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      assigned_to_role TEXT,
      order_index INTEGER,
      started_at DATETIME,
      completed_at DATETIME,
      completed_by INTEGER,
      approved INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (step_id) REFERENCES workflow_steps(id),
      FOREIGN KEY (completed_by) REFERENCES users(id)
    )
  `);

  // Create documents table (Document Management System)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_by INTEGER,
      is_encrypted INTEGER DEFAULT 0,
      encrypted_key TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // Create api_keys table (API Security)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key_name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      api_secret TEXT NOT NULL,
      permissions TEXT,
      rate_limit INTEGER DEFAULT 100,
      is_active INTEGER DEFAULT 1,
      expires_at DATETIME,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create backups table (Backup Management)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      status TEXT DEFAULT 'pending',
      started_by INTEGER,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      metadata TEXT,
      FOREIGN KEY (started_by) REFERENCES users(id)
    )
  `);

  // Create analytics_events table (Advanced Analytics)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      user_id INTEGER,
      session_id TEXT,
      properties TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create webhooks table (Integration System)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      secret TEXT,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_triggered_at DATETIME,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Create scheduled_tasks table (Task Scheduler)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL,
      task_name TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      task_data TEXT,
      is_active INTEGER DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      run_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create visit_attachments table (File Attachments for each department)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS visit_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      department TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_by INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // Insert default roles and permissions
  await insertDefaultRolesAndPermissions();
  
  // Insert default catalog data
  await insertDefaultCatalogData();
  
  // Insert default users
  await insertDefaultUsers();
  
  // Insert default admin user
  await insertAdminUser();
};

const insertDefaultUsers = async () => {
  const users = [
    { username: 'inquiry', password: 'inquiry123', role: 'inquiry', name: 'موظف الاستعلامات', email: 'inquiry@hospital.local' },
    { username: 'lab', password: 'lab123', role: 'lab', name: 'موظف التحليلات', email: 'lab@hospital.local' },
    { username: 'lab_manager', password: 'lab_manager123', role: 'lab_manager', name: 'مدير المختبر', email: 'lab_manager@hospital.local' },
    { username: 'pharmacist', password: 'pharmacist123', role: 'pharmacist', name: 'الصيدلي', email: 'pharmacist@hospital.local' },
    { username: 'pharmacy_manager', password: 'pharmacy_manager123', role: 'pharmacy_manager', name: 'مدير الصيدلية', email: 'pharmacy_manager@hospital.local' },
    { username: 'doctor', password: 'doctor123', role: 'doctor', name: 'الطبيب', email: 'doctor@hospital.local' }
  ];

  console.log('Creating/updating default users...');
  for (const user of users) {
    try {
      const existing = await getQuery(`SELECT id, password FROM users WHERE username = ?`, [user.username]);
      const roleRecord = await getQuery(`SELECT id FROM roles WHERE name = ?`, [user.role]);
      
      if (!existing) {
        // Create new user
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await runQuery(
          `INSERT INTO users (username, password, role, role_id, name, email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [user.username, hashedPassword, user.role, roleRecord?.id || null, user.name, user.email || null, 1]
        );
        console.log(`Created default user: ${user.username} (${user.role})`);
      } else {
        // Update existing user password to ensure it matches
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await runQuery(
          `UPDATE users SET password = ?, role = ?, role_id = ?, name = ?, email = ?, is_active = ? WHERE username = ?`,
          [hashedPassword, user.role, roleRecord?.id || null, user.name, user.email || null, 1, user.username]
        );
        console.log(`Updated password for user: ${user.username} (${user.role})`);
      }
    } catch (error) {
      console.error(`Error creating/updating user ${user.username}:`, error);
    }
  }
  console.log('Default users creation/update completed');
};

const insertDefaultRolesAndPermissions = async () => {
  // Define default roles
  const roles = [
    { name: 'admin', display_name: 'مدير النظام', description: 'صلاحيات كاملة على النظام', is_system_role: 1 },
    { name: 'inquiry', display_name: 'موظف الاستعلامات', description: 'إدارة المرضى والزيارات', is_system_role: 1 },
    { name: 'lab', display_name: 'موظف التحليلات', description: 'إدارة التحاليل المخبرية', is_system_role: 1 },
    { name: 'lab_manager', display_name: 'مدير المختبر', description: 'إدارة كتالوج التحاليل والمجموعات', is_system_role: 1 },
    { name: 'pharmacist', display_name: 'الصيدلي', description: 'إدارة الوصفات الطبية', is_system_role: 1 },
    { name: 'pharmacy_manager', display_name: 'مدير الصيدلية', description: 'إدارة كتالوج الأدوية ومجموعات الوصفات', is_system_role: 1 },
    { name: 'doctor', display_name: 'الطبيب', description: 'التشخيص والعلاج', is_system_role: 1 }
  ];

  // Define permissions (comprehensive list)
  const permissions = [
    // User Management
    { name: 'users.view', display_name: 'عرض المستخدمين', category: 'users' },
    { name: 'users.create', display_name: 'إنشاء مستخدمين', category: 'users' },
    { name: 'users.edit', display_name: 'تعديل المستخدمين', category: 'users' },
    { name: 'users.delete', display_name: 'حذف المستخدمين', category: 'users' },
    { name: 'users.manage_permissions', display_name: 'إدارة صلاحيات المستخدمين', category: 'users' },
    
    // Patient Management
    { name: 'patients.view', display_name: 'عرض المرضى', category: 'patients' },
    { name: 'patients.create', display_name: 'إضافة مرضى', category: 'patients' },
    { name: 'patients.edit', display_name: 'تعديل المرضى', category: 'patients' },
    { name: 'patients.delete', display_name: 'حذف المرضى', category: 'patients' },
    
    // Visit Management
    { name: 'visits.view', display_name: 'عرض الزيارات', category: 'visits' },
    { name: 'visits.create', display_name: 'إنشاء زيارات', category: 'visits' },
    { name: 'visits.edit', display_name: 'تعديل الزيارات', category: 'visits' },
    { name: 'visits.complete', display_name: 'إكمال الزيارات', category: 'visits' },
    { name: 'visits.close', display_name: 'إغلاق الزيارات', category: 'visits' },
    
    // Lab Management
    { name: 'lab.view', display_name: 'عرض التحاليل', category: 'lab' },
    { name: 'lab.create', display_name: 'إضافة تحاليل', category: 'lab' },
    { name: 'lab.edit', display_name: 'تعديل التحاليل', category: 'lab' },
    { name: 'lab.delete', display_name: 'حذف التحاليل', category: 'lab' },
    { name: 'lab.complete', display_name: 'إكمال التحاليل', category: 'lab' },
    { name: 'lab.catalog.manage', display_name: 'إدارة كتالوج التحاليل', category: 'lab' },
    { name: 'lab.panels.manage', display_name: 'إدارة مجموعات التحاليل', category: 'lab' },
    
    // Pharmacy Management
    { name: 'pharmacy.view', display_name: 'عرض الوصفات', category: 'pharmacy' },
    { name: 'pharmacy.create', display_name: 'إضافة وصفات', category: 'pharmacy' },
    { name: 'pharmacy.edit', display_name: 'تعديل الوصفات', category: 'pharmacy' },
    { name: 'pharmacy.delete', display_name: 'حذف الوصفات', category: 'pharmacy' },
    { name: 'pharmacy.dispense', display_name: 'صرف الأدوية', category: 'pharmacy' },
    { name: 'pharmacy.catalog.manage', display_name: 'إدارة كتالوج الأدوية', category: 'pharmacy' },
    { name: 'pharmacy.sets.manage', display_name: 'إدارة مجموعات الوصفات', category: 'pharmacy' },
    
    // Doctor Management
    { name: 'doctor.view', display_name: 'عرض التشخيصات', category: 'doctor' },
    { name: 'doctor.create', display_name: 'إضافة تشخيصات', category: 'doctor' },
    { name: 'doctor.edit', display_name: 'تعديل التشخيصات', category: 'doctor' },
    { name: 'doctor.delete', display_name: 'حذف التشخيصات', category: 'doctor' },
    { name: 'doctor.complete', display_name: 'إكمال التشخيص', category: 'doctor' },
    
    // Reports & Analytics
    { name: 'reports.view', display_name: 'عرض التقارير', category: 'reports' },
    { name: 'reports.export', display_name: 'تصدير التقارير', category: 'reports' },
    { name: 'reports.advanced', display_name: 'تقارير متقدمة', category: 'reports' },
    
    // System Management
    { name: 'system.settings', display_name: 'إعدادات النظام', category: 'system' },
    { name: 'system.audit_log', display_name: 'سجل التدقيق', category: 'system' },
    { name: 'system.backup', display_name: 'النسخ الاحتياطي', category: 'system' },
    
    // Notifications
    { name: 'notifications.send', display_name: 'إرسال إشعارات', category: 'notifications' },
    { name: 'notifications.manage', display_name: 'إدارة الإشعارات', category: 'notifications' }
  ];

  // Insert roles
  console.log('Creating default roles...');
  const roleMap = {};
  for (const role of roles) {
    try {
      let existing = await getQuery(`SELECT id FROM roles WHERE name = ?`, [role.name]);
      if (!existing) {
        const result = await runQuery(
          `INSERT INTO roles (name, display_name, description, is_system_role) VALUES (?, ?, ?, ?)`,
          [role.name, role.display_name, role.description, role.is_system_role]
        );
        roleMap[role.name] = result.lastID;
        console.log(`Created role: ${role.display_name}`);
      } else {
        roleMap[role.name] = existing.id;
        // Update existing role
        await runQuery(
          `UPDATE roles SET display_name = ?, description = ? WHERE name = ?`,
          [role.display_name, role.description, role.name]
        );
      }
    } catch (error) {
      console.error(`Error creating role ${role.name}:`, error);
    }
  }

  // Insert permissions
  console.log('Creating default permissions...');
  const permissionMap = {};
  for (const perm of permissions) {
    try {
      let existing = await getQuery(`SELECT id FROM permissions WHERE name = ?`, [perm.name]);
      if (!existing) {
        const result = await runQuery(
          `INSERT INTO permissions (name, display_name, category, description) VALUES (?, ?, ?, ?)`,
          [perm.name, perm.display_name, perm.category, perm.description || '']
        );
        permissionMap[perm.name] = result.lastID;
      } else {
        permissionMap[perm.name] = existing.id;
      }
    } catch (error) {
      console.error(`Error creating permission ${perm.name}:`, error);
    }
  }

  // Assign permissions to roles
  console.log('Assigning permissions to roles...');
  const rolePermissions = {
    'admin': Object.keys(permissionMap), // All permissions
    'inquiry': ['patients.view', 'patients.create', 'patients.edit', 'patients.delete', 'visits.view', 'visits.create', 'visits.edit', 'visits.close', 'notifications.send'],
    'lab': ['visits.view', 'lab.view', 'lab.create', 'lab.edit', 'lab.delete', 'lab.complete', 'lab.panels.manage', 'notifications.send'],
    'pharmacist': ['visits.view', 'pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.delete', 'pharmacy.dispense', 'pharmacy.sets.manage', 'notifications.send'],
    'pharmacy_manager': ['visits.view', 'pharmacy.view', 'pharmacy.create', 'pharmacy.edit', 'pharmacy.delete', 'pharmacy.dispense', 'pharmacy.catalog.manage', 'pharmacy.sets.manage', 'notifications.send'],
    'doctor': ['visits.view', 'patients.view', 'lab.view', 'pharmacy.view', 'doctor.view', 'doctor.create', 'doctor.edit', 'doctor.delete', 'doctor.complete', 'reports.view', 'reports.export', 'notifications.send']
  };

  for (const [roleName, permNames] of Object.entries(rolePermissions)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;

    for (const permName of permNames) {
      const permId = permissionMap[permName];
      if (!permId) continue;

      try {
        await runQuery(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permId]
        );
      } catch (error) {
        console.error(`Error assigning permission ${permName} to role ${roleName}:`, error);
      }
    }
  }

  console.log('Default roles and permissions setup completed');
};

const insertAdminUser = async () => {
  try {
    const existing = await getQuery(`SELECT id FROM users WHERE username = ?`, ['admin']);
    const adminRole = await getQuery(`SELECT id FROM roles WHERE name = ?`, ['admin']);
    
    if (!existing) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await runQuery(
        `INSERT INTO users (username, password, role, role_id, name, email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['admin', hashedPassword, 'admin', adminRole?.id || null, 'مدير النظام', 'admin@hospital.local', 1]
      );
      console.log('Created admin user: admin / admin123');
    } else {
      // Update admin password and role
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await runQuery(
        `UPDATE users SET password = ?, role = ?, role_id = ?, name = ?, is_active = ? WHERE username = ?`,
        [hashedPassword, 'admin', adminRole?.id || null, 'مدير النظام', 1, 'admin']
      );
      console.log('Updated admin user password');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

const getDb = () => {
  if (!db) {
    console.error('Database not initialized. Make sure db.init() is called first.');
    throw new Error('Database not initialized. Please restart the server.');
  }
  return db;
};

const runQuery = async (query, params = []) => {
  if (DB_TYPE === 'mysql') {
    return await db.runQuery(query, params);
  } else {
    return new Promise((resolve, reject) => {
      getDb().run(query, params, function(err) {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }
};

const getQuery = async (query, params = []) => {
  if (DB_TYPE === 'mysql') {
    return await db.getQuery(query, params);
  } else {
    return new Promise((resolve, reject) => {
      getDb().get(query, params, (err, row) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
};

const allQuery = async (query, params = []) => {
  if (DB_TYPE === 'mysql') {
    return await db.allQuery(query, params);
  } else {
    return new Promise((resolve, reject) => {
      getDb().all(query, params, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
};

// Insert default catalog data
const insertDefaultCatalogData = async () => {
  try {
    console.log('Inserting default catalog data...');
    
    // Get admin user ID for created_by
    const adminUser = await getQuery("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminUser ? adminUser.id : 1;

    // Insert default lab tests (common kidney-related tests)
    const defaultLabTests = [
      { test_name: 'Creatinine', test_name_ar: 'الكرياتينين', unit: 'mg/dL', normal_range_min: '0.6', normal_range_max: '1.2', description: 'قياس وظيفة الكلى' },
      { test_name: 'Urea', test_name_ar: 'اليوريا', unit: 'mg/dL', normal_range_min: '7', normal_range_max: '20', description: 'قياس وظيفة الكلى' },
      { test_name: 'eGFR', test_name_ar: 'معدل الترشيح الكلوي', unit: 'mL/min/1.73m²', normal_range_min: '90', normal_range_max: '120', description: 'معدل الترشيح الكبيبي المقدر' },
      { test_name: 'Hemoglobin', test_name_ar: 'الهيموجلوبين', unit: 'g/dL', normal_range_min: '12', normal_range_max: '16', description: 'قياس فقر الدم' },
      { test_name: 'Hematocrit', test_name_ar: 'الهيماتوكريت', unit: '%', normal_range_min: '36', normal_range_max: '46', description: 'نسبة خلايا الدم الحمراء' },
      { test_name: 'Potassium', test_name_ar: 'البوتاسيوم', unit: 'mEq/L', normal_range_min: '3.5', normal_range_max: '5.0', description: 'الكهارل' },
      { test_name: 'Sodium', test_name_ar: 'الصوديوم', unit: 'mEq/L', normal_range_min: '135', normal_range_max: '145', description: 'الكهارل' },
      { test_name: 'Calcium', test_name_ar: 'الكالسيوم', unit: 'mg/dL', normal_range_min: '8.5', normal_range_max: '10.5', description: 'المعادن' },
      { test_name: 'Phosphorus', test_name_ar: 'الفوسفور', unit: 'mg/dL', normal_range_min: '2.5', normal_range_max: '4.5', description: 'المعادن' },
      { test_name: 'PTH', test_name_ar: 'هرمون الجار درقي', unit: 'pg/mL', normal_range_min: '10', normal_range_max: '65', description: 'هرمون الجار درقي' }
    ];

    for (const test of defaultLabTests) {
      try {
        const existing = await getQuery('SELECT id FROM lab_tests_catalog WHERE test_name = ?', [test.test_name]);
        if (!existing) {
          await runQuery(
            `INSERT INTO lab_tests_catalog (test_name, test_name_ar, unit, normal_range_min, normal_range_max, description, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [test.test_name, test.test_name_ar, test.unit, test.normal_range_min, test.normal_range_max, test.description, adminId]
          );
        }
      } catch (error) {
        console.warn(`Error inserting lab test ${test.test_name}:`, error.message);
      }
    }

    // Insert default drugs (common kidney-related medications)
    const defaultDrugs = [
      { drug_name: 'Calcium Carbonate', drug_name_ar: 'كربونات الكالسيوم', form: 'Tablet', strength: '500mg', description: 'منظم الفوسفور' },
      { drug_name: 'Sevelamer', drug_name_ar: 'سيفلامير', form: 'Tablet', strength: '800mg', description: 'منظم الفوسفور' },
      { drug_name: 'Erythropoietin', drug_name_ar: 'الإريثروبويتين', form: 'Injection', strength: '4000 IU', description: 'لعلاج فقر الدم' },
      { drug_name: 'Iron Sucrose', drug_name_ar: 'سكروز الحديد', form: 'Injection', strength: '100mg', description: 'مكملات الحديد' },
      { drug_name: 'Folic Acid', drug_name_ar: 'حمض الفوليك', form: 'Tablet', strength: '5mg', description: 'فيتامين' },
      { drug_name: 'Vitamin D', drug_name_ar: 'فيتامين د', form: 'Capsule', strength: '50000 IU', description: 'فيتامين' },
      { drug_name: 'Enalapril', drug_name_ar: 'إينالابريل', form: 'Tablet', strength: '10mg', description: 'ضغط الدم' },
      { drug_name: 'Amlodipine', drug_name_ar: 'أملوديبين', form: 'Tablet', strength: '5mg', description: 'ضغط الدم' },
      { drug_name: 'Omeprazole', drug_name_ar: 'أوميبرازول', form: 'Capsule', strength: '20mg', description: 'حماية المعدة' },
      { drug_name: 'Paracetamol', drug_name_ar: 'باراسيتامول', form: 'Tablet', strength: '500mg', description: 'مسكن ومخفض للحرارة' }
    ];

    for (const drug of defaultDrugs) {
      try {
        const existing = await getQuery('SELECT id FROM drugs_catalog WHERE drug_name = ?', [drug.drug_name]);
        if (!existing) {
          await runQuery(
            `INSERT INTO drugs_catalog (drug_name, drug_name_ar, form, strength, description, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [drug.drug_name, drug.drug_name_ar, drug.form, drug.strength, drug.description, adminId]
          );
        }
      } catch (error) {
        console.warn(`Error inserting drug ${drug.drug_name}:`, error.message);
      }
    }

    console.log('Default catalog data inserted successfully');
  } catch (error) {
    console.error('Error inserting default catalog data:', error);
  }
};

// Export based on DB type
if (DB_TYPE === 'prisma' || process.env.DATABASE_URL) {
  module.exports = require('./db-prisma');
} else if (DB_TYPE === 'mysql') {
  module.exports = require('./db-mysql');
} else {
  module.exports = {
    init,
    getDb,
    runQuery,
    getQuery,
    allQuery
  };
}
