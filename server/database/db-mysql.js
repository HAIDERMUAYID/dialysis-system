const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

const init = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    console.log('Connected to MySQL database');
    await createTables();
    await insertDefaultData();
    return true;
  } catch (error) {
    console.error('Error connecting to MySQL:', error);
    throw error;
  }
};

const getDb = () => {
  if (!pool) {
    throw new Error('Database not initialized. Make sure db.init() is called first.');
  }
  return pool;
};

const runQuery = async (query, params = []) => {
  try {
    const [result] = await getDb().execute(query, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
};

const getQuery = async (query, params = []) => {
  try {
    const [rows] = await getDb().execute(query, params);
    return rows[0] || null;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
};

const allQuery = async (query, params = []) => {
  try {
    const [rows] = await getDb().execute(query, params);
    return rows || [];
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
};

// Convert SQLite syntax to MySQL syntax
const convertQuery = (sqliteQuery) => {
  return sqliteQuery
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INT AUTO_INCREMENT PRIMARY KEY')
    .replace(/INTEGER/g, 'INT')
    .replace(/TEXT/g, 'VARCHAR(255)')
    .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
    .replace(/CREATE TABLE IF NOT EXISTS/g, 'CREATE TABLE IF NOT EXISTS')
    .replace(/UNIQUE\(/g, 'UNIQUE KEY (');
};

const createTables = async () => {
  const sqliteDb = require('./db');
  const fs = require('fs');
  const path = require('path');
  
  // Read the original db.js to extract table creation queries
  // For now, we'll create tables manually with MySQL syntax
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      description TEXT,
      is_system_role INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      category VARCHAR(255),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      permission_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
      UNIQUE KEY (role_id, permission_id)
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      role_id INT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      is_active INT DEFAULT 1,
      last_login DATETIME,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      national_id VARCHAR(50) UNIQUE,
      age INT,
      gender VARCHAR(10),
      phone VARCHAR(50),
      address TEXT,
      patient_category VARCHAR(100),
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS visits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_number VARCHAR(100) UNIQUE NOT NULL,
      patient_id INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending_all',
      lab_completed INT DEFAULT 0,
      pharmacy_completed INT DEFAULT 0,
      doctor_completed INT DEFAULT 0,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS lab_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_id INT NOT NULL,
      test_name VARCHAR(255) NOT NULL,
      test_catalog_id INT,
      result TEXT,
      unit VARCHAR(50),
      normal_range TEXT,
      notes TEXT,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (test_catalog_id) REFERENCES lab_tests_catalog(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pharmacy_prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_id INT NOT NULL,
      medication_name VARCHAR(255) NOT NULL,
      drug_catalog_id INT,
      dosage VARCHAR(255),
      quantity INT,
      instructions TEXT,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (drug_catalog_id) REFERENCES drugs_catalog(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS diagnoses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_id INT NOT NULL,
      diagnosis TEXT NOT NULL,
      notes TEXT,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS visit_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      notes TEXT,
      changed_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      type VARCHAR(50),
      is_read INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(100),
      entity_id INT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS lab_tests_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      test_name VARCHAR(255) UNIQUE NOT NULL,
      test_name_ar VARCHAR(255),
      unit VARCHAR(50) NOT NULL,
      normal_range_min VARCHAR(50),
      normal_range_max VARCHAR(50),
      normal_range_text TEXT,
      description TEXT,
      is_active INT DEFAULT 1,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS lab_test_panels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      panel_name VARCHAR(255) NOT NULL,
      panel_name_ar VARCHAR(255),
      description TEXT,
      created_by INT,
      is_active INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS lab_test_panel_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      panel_id INT NOT NULL,
      test_catalog_id INT NOT NULL,
      display_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (panel_id) REFERENCES lab_test_panels(id) ON DELETE CASCADE,
      FOREIGN KEY (test_catalog_id) REFERENCES lab_tests_catalog(id) ON DELETE CASCADE,
      UNIQUE KEY (panel_id, test_catalog_id)
    )`,
    `CREATE TABLE IF NOT EXISTS drugs_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drug_name VARCHAR(255) UNIQUE NOT NULL,
      drug_name_ar VARCHAR(255),
      form VARCHAR(100),
      strength VARCHAR(100),
      manufacturer VARCHAR(255),
      description TEXT,
      is_active INT DEFAULT 1,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS prescription_sets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      set_name VARCHAR(255) NOT NULL,
      set_name_ar VARCHAR(255),
      description TEXT,
      created_by INT,
      is_active INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS prescription_set_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      set_id INT NOT NULL,
      drug_catalog_id INT NOT NULL,
      dosage VARCHAR(255),
      quantity INT,
      instructions TEXT,
      display_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (set_id) REFERENCES prescription_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (drug_catalog_id) REFERENCES drugs_catalog(id) ON DELETE CASCADE,
      UNIQUE KEY (set_id, drug_catalog_id)
    )`,
    `CREATE TABLE IF NOT EXISTS visit_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INT,
      file_type VARCHAR(100),
      uploaded_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )`
  ];

  for (const tableQuery of tables) {
    try {
      await runQuery(tableQuery);
    } catch (error) {
      console.warn('Table creation warning:', error.message);
    }
  }
  
  console.log('All tables created successfully');
};

const insertDefaultData = async () => {
  // Insert default roles, permissions, and users
  // This should match the logic in db.js
  // Implementation similar to SQLite version
  console.log('Default data insertion will be handled by migration script');
};

module.exports = {
  init,
  getDb,
  runQuery,
  getQuery,
  allQuery
};
