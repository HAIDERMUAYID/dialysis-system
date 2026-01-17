# دليل النشر مع Supabase و Prisma

هذا الدليل يشرح كيفية رفع النظام على الويب باستخدام **Supabase** (PostgreSQL) و **Prisma ORM**.

## لماذا Supabase + Prisma؟

### ✅ المميزات:
- **Supabase**: قاعدة بيانات PostgreSQL مُدارة (managed) مجانية حتى 500MB
- **Prisma**: ORM قوي وآمن يسهل التعامل مع قاعدة البيانات
- **Type Safety**: دعم كامل لـ TypeScript
- **Real-time**: Supabase يدعم Real-time subscriptions
- **Authentication**: يمكن استخدام Supabase Auth لاحقاً
- **Storage**: يمكن استخدام Supabase Storage للملفات

## الخطوات التفصيلية

### الخطوة 1: إنشاء حساب Supabase

1. اذهب إلى https://supabase.com
2. أنشئ حساب جديد (مجاني)
3. أنشئ مشروع جديد:
   - **Name**: hospital-system
   - **Database Password**: اختر كلمة مرور قوية واحفظها
   - **Region**: اختر الأقرب لك

### الخطوة 2: الحصول على Connection String

1. في Supabase Dashboard، اذهب إلى **Settings** → **Database**
2. ابحث عن **Connection string** → **URI**
3. انسخ الـ Connection String (سيبدو هكذا):
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
   ```
4. استبدل `[YOUR-PASSWORD]` بكلمة المرور التي اخترتها

### الخطوة 3: إعداد المشروع محلياً

#### 3.1 تثبيت Prisma
```bash
npm install @prisma/client
npm install -D prisma
```

#### 3.2 إعداد ملف .env
```bash
cp .env.example .env
nano .env
```

أضف:
```env
NODE_ENV=production
PORT=5001

# Supabase Database URL
DB_TYPE=prisma
DATABASE_URL="postgresql://postgres.xxxxx:your_password@aws-0-region.pooler.supabase.com:6543/postgres"

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Client URL
CLIENT_URL=https://yourdomain.com
```

#### 3.3 إنشاء قاعدة البيانات
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (إنشاء الجداول)
npm run prisma:migrate
```

عند السؤال عن اسم الـ migration، اكتب: `init`

### الخطوة 4: إدخال البيانات الافتراضية

بعد إنشاء الجداول، سيتم إدخال البيانات الافتراضية تلقائياً (الأدوار والمستخدمين).

يمكنك التحقق من البيانات باستخدام:
```bash
npm run prisma:studio
```

هذا سيفتح واجهة رسومية لعرض وتعديل البيانات.

### الخطوة 5: رفع الكود على الخادم

#### 5.1 إعداد الخادم (VPS)
```bash
# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# تثبيت PM2
npm install -g pm2
```

#### 5.2 رفع الملفات
```bash
# على الخادم
cd /var/www
git clone https://github.com/your-username/hosptal.git
cd hosptal
```

#### 5.3 إعداد .env على الخادم
```bash
nano .env
```

أضف نفس `DATABASE_URL` من Supabase:
```env
NODE_ENV=production
PORT=5001
DB_TYPE=prisma
DATABASE_URL="postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres"
JWT_SECRET=your-secret-key
CLIENT_URL=https://yourdomain.com
```

#### 5.4 تثبيت المتطلبات
```bash
# Backend
npm install --production

# Frontend
cd client
npm install
npm run build
cd ..

# Generate Prisma Client
npm run prisma:generate
```

### الخطوة 6: إعداد Nginx

```bash
nano /etc/nginx/sites-available/hospital
```

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /var/www/hosptal/client/build;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### الخطوة 7: تشغيل التطبيق

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### الخطوة 8: إعداد SSL (HTTPS)

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

## إدارة قاعدة البيانات

### عرض البيانات
```bash
npm run prisma:studio
```

### إنشاء Migration جديد
```bash
npm run prisma:migrate
```

### تطبيق Migrations على الإنتاج
```bash
npm run prisma:deploy
```

### إعادة تعيين قاعدة البيانات (⚠️ حذف جميع البيانات)
```bash
npx prisma migrate reset
```

## النسخ الاحتياطي

### من Supabase Dashboard:
1. اذهب إلى **Database** → **Backups**
2. يمكنك تحميل نسخة احتياطية يدوياً

### من Command Line:
```bash
# Export database
pg_dump "postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres" > backup.sql

# Import database
psql "postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres" < backup.sql
```

## استكشاف الأخطاء

### مشكلة الاتصال بقاعدة البيانات
```bash
# اختبار الاتصال
npx prisma db pull
```

### مشكلة في Prisma Client
```bash
# إعادة توليد Prisma Client
npm run prisma:generate
```

### عرض السجلات
```bash
pm2 logs hospital-api
```

## ملاحظات مهمة

1. **Connection Pooling**: Supabase يستخدم Connection Pooling على المنفذ 6543
2. **SSL**: تأكد من تفعيل SSL في Production
3. **Environment Variables**: لا تشارك `DATABASE_URL` أو `JWT_SECRET` أبداً
4. **Migrations**: قم بعمل Migration لكل تغيير في Schema
5. **Backups**: قم بعمل نسخ احتياطية منتظمة

## الخطوات التالية (اختياري)

### استخدام Supabase Storage للملفات
بدلاً من رفع الملفات على الخادم، يمكن استخدام Supabase Storage:
- مجاني حتى 1GB
- CDN مدمج
- Real-time updates

### استخدام Supabase Auth
يمكن دمج Supabase Authentication لاحقاً لتحسين الأمان.

## الدعم

- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Supabase Discord**: https://discord.supabase.com
