// Shared types for the application

export interface Patient {
  id: number;
  name: string;
  national_id?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  age?: number;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  address?: string;
  city?: string;
  patient_category?: string;
  medical_history?: string;
  allergies?: string;
  chronic_diseases?: string;
  current_medications?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  insurance_number?: string;
  insurance_type?: string;
  notes?: string;
  is_active?: number;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Visit {
  id: number;
  visit_number: string;
  patient_id: number;
  patient_name?: string;
  national_id?: string;
  age?: number;
  gender?: string;
  status: string;
  visit_type?: string; // 'normal' or 'doctor_directed'
  lab_completed?: number; // 0 or 1
  pharmacy_completed?: number; // 0 or 1
  doctor_completed?: number; // 0 or 1
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface LabResult {
  id?: number;
  visit_id?: number;
  test_name: string;
  result: string;
  unit: string;
  normal_range: string;
  notes: string;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Prescription {
  id?: number;
  visit_id?: number;
  medication_name: string;
  dosage: string;
  quantity?: number;
  instructions: string;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Diagnosis {
  id?: number;
  visit_id?: number;
  diagnosis: string;
  notes: string;
  created_by?: number;
  doctor_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StatusHistory {
  id: number;
  visit_id: number;
  status: string;
  changed_by?: number;
  changed_by_name?: string;
  notes: string;
  created_at: string;
}

export interface VisitDetails extends Visit {
  visit_type?: string; // 'normal' or 'doctor_directed'
  phone?: string;
  address?: string;
  lab_results: LabResult[];
  prescriptions: Prescription[];
  diagnoses: Diagnosis[];
  status_history: StatusHistory[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: number;
  visit_id: number;
  department: string;
  entity_type?: string;
  entity_id?: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  description?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  visit_id?: number;
  from_user_id?: number;
  to_user_id?: number;
  to_role?: string;
  type: string;
  title: string;
  message: string;
  status: 'read' | 'unread';
  created_at: string;
  read_at?: string;
  from_user_name?: string;
  visit_number?: string;
}

export interface ActivityLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  name: string;
  created_at?: string;
}

export interface Stats {
  total_patients: number;
  total_visits: number;
  pending_lab: number;
  pending_pharmacy: number;
  pending_doctor: number;
  completed_visits: number;
  today_visits: number;
  this_week_visits?: number;
  this_month_visits?: number;
  total_users: number;
  active_users?: number;
  total_lab_results?: number;
  total_prescriptions?: number;
  total_diagnoses?: number;
  unread_notifications?: number;
  visit_trends?: Array<{ date: string; count: number }>;
  department_performance?: {
    lab: { completed: number; pending: number; avg_time: number };
    pharmacy: { completed: number; pending: number; avg_time: number };
    doctor: { completed: number; pending: number; avg_time: number };
  };
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system_role: number;
  created_at?: string;
  users_count?: number;
  permissions_count?: number;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  display_name: string;
  category?: string;
  description?: string;
  created_at?: string;
  roles_count?: number;
}

export interface UserEnhanced extends User {
  role_id?: number;
  role_display_name?: string;
  email?: string;
  phone?: string;
  is_active?: number;
  last_login?: string;
  created_by?: number;
  created_by_name?: string;
  active_sessions?: number;
  permissions?: Permission[];
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  details?: string;
  created_at: string;
}

export interface PatientFullReport {
  patient: Patient;
  visits: Array<Visit & {
    lab_results: LabResult[];
    prescriptions: Prescription[];
    diagnoses: Diagnosis[];
    attachments?: Attachment[];
    status_history?: StatusHistory[];
  }>;
}

// Catalog Types
export interface LabTestCatalog {
  id: number;
  test_name: string;
  test_name_ar?: string;
  unit: string;
  normal_range_min?: string;
  normal_range_max?: string;
  normal_range_text?: string;
  description?: string;
  is_active: number;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LabTestPanel {
  id: number;
  panel_name: string;
  panel_name_ar?: string;
  description?: string;
  created_by?: number;
  created_by_name?: string;
  is_active: number;
  tests_count?: number;
  created_at?: string;
  updated_at?: string;
  tests?: LabTestPanelItem[];
}

export interface LabTestPanelItem {
  id: number;
  panel_id: number;
  test_catalog_id: number;
  display_order: number;
  test_name?: string;
  test_name_ar?: string;
  unit?: string;
  normal_range_min?: string;
  normal_range_max?: string;
  normal_range_text?: string;
}

export interface DrugCatalog {
  id: number;
  drug_name: string;
  drug_name_ar?: string;
  form?: string;
  strength?: string;
  manufacturer?: string;
  description?: string;
  is_active: number;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PrescriptionSet {
  id: number;
  set_name: string;
  set_name_ar?: string;
  description?: string;
  created_by?: number;
  created_by_name?: string;
  is_active: number;
  drugs_count?: number;
  created_at?: string;
  updated_at?: string;
  drugs?: PrescriptionSetItem[];
}

export interface PrescriptionSetItem {
  id: number;
  set_id: number;
  drug_catalog_id: number;
  default_dosage?: string;
  display_order: number;
  drug_name?: string;
  drug_name_ar?: string;
  form?: string;
  strength?: string;
}

// Update LabResult and Prescription to include catalog references
export interface LabResult {
  id?: number;
  visit_id?: number;
  test_name: string;
  test_catalog_id?: number;
  result: string;
  unit: string;
  normal_range: string;
  notes: string;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Prescription {
  id?: number;
  visit_id?: number;
  medication_name: string;
  drug_catalog_id?: number;
  dosage: string;
  quantity?: number;
  instructions: string;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}
