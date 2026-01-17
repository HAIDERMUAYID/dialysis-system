# دليل النشر السريع

## الخطوات السريعة لرفع النظام على الويب

### 1. اختيار مزود الاستضافة

**الخيارات الموصى بها:**
- **DigitalOcean**: سهل الاستخدام، من $6/شهر
- **Vultr**: سريع، من $6/شهر  
- **AWS EC2**: احترافي، من $10/شهر

### 2. إعداد الخادم (DigitalOcean مثال)

#### أ. إنشاء Droplet
1. اذهب إلى https://www.digitalocean.com
2. أنشئ حساب جديد
3. أنشئ Droplet جديد:
   - **OS**: Ubuntu 22.04
   - **Plan**: Basic ($6/شهر كافٍ للبداية)
   - **Region**: اختر الأقرب لك
   - **Authentication**: SSH Key أو Password

#### ب. الاتصال بالخادم
```bash
ssh root@your-server-ip
```

### 3. تثبيت المتطلبات

```bash
# تحديث النظام
apt update && apt upgrade -y

# تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# تثبيت MySQL
apt install mysql-server -y
mysql_secure_installation

# تثبيت Nginx
apt install nginx -y

# تثبيت PM2
npm install -g pm2
```

### 4. إعداد قاعدة البيانات

```bash
mysql -u root -p
```

```sql
CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hospital_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON hospital_db.* TO 'hospital_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5. رفع الملفات

#### الطريقة 1: استخدام Git
```bash
cd /var/www
git clone https://github.com/your-username/hosptal.git
cd hosptal
```

#### الطريقة 2: استخدام SCP (من جهازك المحلي)
```bash
scp -r /path/to/hosptal root@your-server-ip:/var/www/
```

### 6. إعداد ملف .env

```bash
cd /var/www/hosptal
cp .env.example .env
nano .env
```

عدّل الملف:
```env
NODE_ENV=production
PORT=5001
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hospital_db
DB_USER=hospital_user
DB_PASSWORD=StrongPassword123!
JWT_SECRET=change-this-to-random-string
CLIENT_URL=http://your-server-ip
```

### 7. تثبيت المتطلبات

```bash
# Backend
npm install --production

# Frontend
cd client
npm install
npm run build
cd ..
```

### 8. إعداد Nginx

```bash
nano /etc/nginx/sites-available/hospital
```

أضف:
```nginx
server {
    listen 80;
    server_name your-server-ip;

    location / {
        root /var/www/hosptal/client/build;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 9. تشغيل التطبيق

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 10. الوصول للنظام

افتح المتصفح واذهب إلى: `http://your-server-ip`

## ملاحظات مهمة

1. **الأمان**: غيّر جميع كلمات المرور الافتراضية
2. **SSL**: للحصول على HTTPS، استخدم Let's Encrypt:
   ```bash
   apt install certbot python3-certbot-nginx
   certbot --nginx -d yourdomain.com
   ```
3. **النسخ الاحتياطي**: قم بعمل نسخ احتياطي يومي:
   ```bash
   mysqldump -u hospital_user -p hospital_db > backup.sql
   ```

## استكشاف الأخطاء

```bash
# عرض سجلات PM2
pm2 logs

# إعادة تشغيل
pm2 restart hospital-api

# حالة Nginx
systemctl status nginx

# سجلات Nginx
tail -f /var/log/nginx/error.log
```
