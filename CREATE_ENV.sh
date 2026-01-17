#!/bin/bash

# سكريبت لإنشاء ملف .env

cat > .env << 'EOF'
# Server Configuration
PORT=5001
NODE_ENV=development

# Client URL
CLIENT_URL=http://localhost:3000

# Database Configuration
# اختر أحد الخيارات التالية:

# الخيار 1: Supabase (موصى به للإنتاج)
# قم بإلغاء التعليق وإضافة DATABASE_URL من Supabase:
# DB_TYPE=prisma
# DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"

# الخيار 2: PostgreSQL محلي
# DB_TYPE=prisma
# DATABASE_URL="postgresql://postgres:password@localhost:5432/hospital_db"

# الخيار 3: SQLite (للاختبار فقط - Prisma لا يدعمه بشكل جيد)
DB_TYPE=sqlite
DB_PATH=./database.sqlite

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
EOF

echo "✅ تم إنشاء ملف .env"
echo ""
echo "⚠️  ملاحظة: إذا كنت تريد استخدام Supabase:"
echo "   1. اذهب إلى https://supabase.com"
echo "   2. أنشئ حساب ومشروع جديد"
echo "   3. Settings → Database → Connection string → URI"
echo "   4. عدّل ملف .env وأضف DATABASE_URL"
echo ""
echo "بعد إضافة DATABASE_URL، شغّل:"
echo "   npx prisma db push"
echo "   أو"
echo "   npm run prisma:migrate"
