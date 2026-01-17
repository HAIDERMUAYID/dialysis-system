-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_system_role" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "role_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "last_login" TIMESTAMP(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "national_id" VARCHAR(50),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "email" VARCHAR(255),
    "age" INTEGER,
    "date_of_birth" DATE,
    "gender" VARCHAR(10),
    "blood_type" VARCHAR(10),
    "address" TEXT,
    "city" VARCHAR(255),
    "patient_category" VARCHAR(100),
    "medical_history" TEXT,
    "allergies" TEXT,
    "chronic_diseases" TEXT,
    "current_medications" TEXT,
    "emergency_contact_name" VARCHAR(255),
    "emergency_contact_phone" VARCHAR(50),
    "emergency_contact_relation" VARCHAR(100),
    "insurance_number" VARCHAR(100),
    "insurance_type" VARCHAR(100),
    "notes" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "visit_number" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending_inquiry',
    "lab_completed" INTEGER NOT NULL DEFAULT 0,
    "pharmacy_completed" INTEGER NOT NULL DEFAULT 0,
    "doctor_completed" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "test_name" VARCHAR(255) NOT NULL,
    "test_catalog_id" INTEGER,
    "result" TEXT,
    "unit" VARCHAR(50),
    "normal_range" TEXT,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_prescriptions" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "medication_name" VARCHAR(255) NOT NULL,
    "drug_catalog_id" INTEGER,
    "dosage" VARCHAR(255),
    "quantity" INTEGER,
    "instructions" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_status_history" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "type" VARCHAR(50),
    "is_read" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" INTEGER,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests_catalog" (
    "id" SERIAL NOT NULL,
    "test_name" VARCHAR(255) NOT NULL,
    "test_name_ar" VARCHAR(255),
    "unit" VARCHAR(50) NOT NULL,
    "normal_range_min" VARCHAR(50),
    "normal_range_max" VARCHAR(50),
    "normal_range_text" TEXT,
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_panels" (
    "id" SERIAL NOT NULL,
    "panel_name" VARCHAR(255) NOT NULL,
    "panel_name_ar" VARCHAR(255),
    "description" TEXT,
    "created_by" INTEGER,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_panel_items" (
    "id" SERIAL NOT NULL,
    "panel_id" INTEGER NOT NULL,
    "test_catalog_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_test_panel_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drugs_catalog" (
    "id" SERIAL NOT NULL,
    "drug_name" VARCHAR(255) NOT NULL,
    "drug_name_ar" VARCHAR(255),
    "form" VARCHAR(100),
    "strength" VARCHAR(100),
    "manufacturer" VARCHAR(255),
    "description" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drugs_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_sets" (
    "id" SERIAL NOT NULL,
    "set_name" VARCHAR(255) NOT NULL,
    "set_name_ar" VARCHAR(255),
    "description" TEXT,
    "created_by" INTEGER,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_set_items" (
    "id" SERIAL NOT NULL,
    "set_id" INTEGER NOT NULL,
    "drug_catalog_id" INTEGER NOT NULL,
    "dosage" VARCHAR(255),
    "quantity" INTEGER,
    "instructions" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_set_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_attachments" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" INTEGER,
    "file_type" VARCHAR(100),
    "uploaded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "patients_national_id_key" ON "patients"("national_id");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_created_at_idx" ON "patients"("created_at");

-- CreateIndex
CREATE INDEX "patients_is_active_idx" ON "patients"("is_active");

-- CreateIndex
CREATE INDEX "patients_name_is_active_idx" ON "patients"("name", "is_active");

-- CreateIndex
CREATE INDEX "patients_national_id_is_active_idx" ON "patients"("national_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "visits_visit_number_key" ON "visits"("visit_number");

-- CreateIndex
CREATE INDEX "visits_patient_id_idx" ON "visits"("patient_id");

-- CreateIndex
CREATE INDEX "visits_status_idx" ON "visits"("status");

-- CreateIndex
CREATE INDEX "visits_created_at_idx" ON "visits"("created_at");

-- CreateIndex
CREATE INDEX "visits_lab_completed_idx" ON "visits"("lab_completed");

-- CreateIndex
CREATE INDEX "visits_pharmacy_completed_idx" ON "visits"("pharmacy_completed");

-- CreateIndex
CREATE INDEX "visits_doctor_completed_idx" ON "visits"("doctor_completed");

-- CreateIndex
CREATE INDEX "visits_status_lab_completed_idx" ON "visits"("status", "lab_completed");

-- CreateIndex
CREATE INDEX "visits_status_pharmacy_completed_idx" ON "visits"("status", "pharmacy_completed");

-- CreateIndex
CREATE INDEX "visits_status_doctor_completed_idx" ON "visits"("status", "doctor_completed");

-- CreateIndex
CREATE INDEX "lab_results_visit_id_idx" ON "lab_results"("visit_id");

-- CreateIndex
CREATE INDEX "lab_results_created_at_idx" ON "lab_results"("created_at");

-- CreateIndex
CREATE INDEX "pharmacy_prescriptions_visit_id_idx" ON "pharmacy_prescriptions"("visit_id");

-- CreateIndex
CREATE INDEX "pharmacy_prescriptions_created_at_idx" ON "pharmacy_prescriptions"("created_at");

-- CreateIndex
CREATE INDEX "visit_status_history_visit_id_idx" ON "visit_status_history"("visit_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "activity_log_user_id_idx" ON "activity_log"("user_id");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_idx" ON "activity_log"("entity_type");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_catalog_test_name_key" ON "lab_tests_catalog"("test_name");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_panel_items_panel_id_test_catalog_id_key" ON "lab_test_panel_items"("panel_id", "test_catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "drugs_catalog_drug_name_key" ON "drugs_catalog"("drug_name");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_set_items_set_id_drug_catalog_id_key" ON "prescription_set_items"("set_id", "drug_catalog_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_test_catalog_id_fkey" FOREIGN KEY ("test_catalog_id") REFERENCES "lab_tests_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_drug_catalog_id_fkey" FOREIGN KEY ("drug_catalog_id") REFERENCES "drugs_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_prescriptions" ADD CONSTRAINT "pharmacy_prescriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_status_history" ADD CONSTRAINT "visit_status_history_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_status_history" ADD CONSTRAINT "visit_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests_catalog" ADD CONSTRAINT "lab_tests_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_panels" ADD CONSTRAINT "lab_test_panels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_panel_items" ADD CONSTRAINT "lab_test_panel_items_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "lab_test_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_panel_items" ADD CONSTRAINT "lab_test_panel_items_test_catalog_id_fkey" FOREIGN KEY ("test_catalog_id") REFERENCES "lab_tests_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drugs_catalog" ADD CONSTRAINT "drugs_catalog_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_sets" ADD CONSTRAINT "prescription_sets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_set_items" ADD CONSTRAINT "prescription_set_items_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "prescription_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_set_items" ADD CONSTRAINT "prescription_set_items_drug_catalog_id_fkey" FOREIGN KEY ("drug_catalog_id") REFERENCES "drugs_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_attachments" ADD CONSTRAINT "visit_attachments_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_attachments" ADD CONSTRAINT "visit_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
