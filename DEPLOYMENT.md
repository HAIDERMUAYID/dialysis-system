# دليل نشر النظام على الويب

هذا الدليل يشرح كيفية رفع نظام إدارة مستشفى الحكيم على الويب وربطه بقاعدة بيانات حقيقية.

## المتطلبات الأساسية

### 1. خادم ويب (VPS أو Cloud Server)
- **الخيارات الموصى بها:**
  - **DigitalOcean**: https://www.digitalocean.com (من $6/شهر)
  - **AWS EC2**: https://aws.amazon.com/ec2
  - **Google Cloud Platform**: https://cloud.google.com
  - **Azure**: https://azure.microsoft.com
  - **Vultr**: https://www.vultr.com (من $6/شهر)
  - **Linode**: https://www.linode.com (من $5/شهر)

### 2. قاعدة بيانات
- **MySQL** (موصى به) أو **PostgreSQL**
- يمكن استخدام:
  - قاعدة بيانات على نفس الخادم
  - قاعدة بيانات منفصلة (مثل AWS RDS، DigitalOcean Managed Database)

### 3. نطاق (Domain) - اختياري
- يمكن شراء نطاق من:
  - Namecheap: https://www.namecheap.com
  - GoDaddy: https://www.godaddy.com
  - Cloudflare: https://www.cloudflare.com

## الخطوات التفصيلية

### الخطوة 1: إعداد الخادم

#### 1.1 الاتصال بالخادم
```bash
ssh root@your-server-ip
```

#### 1.2 تحديث النظام
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

#### 1.3 تثبيت Node.js
```bash
# تثبيت Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# التحقق من التثبيت
node --version
npm --version
```

#### 1.4 تثبيت PM2 (لإدارة العملية)
```bash
sudo npm install -g pm2
```

#### 1.5 تثبيت Nginx (كخادم ويب عكسي)
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### الخطوة 2: إعداد قاعدة البيانات

#### 2.1 تثبيت MySQL
```bash
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

#### 2.2 إنشاء قاعدة البيانات والمستخدم
```bash
sudo mysql -u root -p
```

ثم في MySQL:
```sql
CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hospital_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON hospital_db.* TO 'hospital_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### الخطوة 3: رفع الملفات إلى الخادم

#### 3.1 رفع الملفات باستخدام SCP
```bash
# من جهازك المحلي
scp -r /path/to/hosptal root@your-server-ip:/var/www/
```

#### 3.2 أو استخدام Git
```bash
# على الخادم
cd /var/www
git clone https://github.com/your-username/hosptal.git
cd hosptal
```

### الخطوة 4: إعداد متغيرات البيئة

#### 4.1 إنشاء ملف .env
```bash
cd /var/www/hosptal
cp .env.example .env
nano .env
```

#### 4.2 تعديل ملف .env
```env
NODE_ENV=production
PORT=5001

# قاعدة البيانات MySQL
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hospital_db
DB_USER=hospital_user
DB_PASSWORD=your_strong_password_here

# JWT Secret (غيّر هذا!)
JWT_SECRET=your-very-strong-secret-key-change-this

# Client URL (URL الخاص بالموقع)
CLIENT_URL=https://yourdomain.com

# إعدادات أخرى
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
LOG_LEVEL=info
LOG_DIR=./logs
```

### الخطوة 5: تثبيت المتطلبات

#### 5.1 تثبيت متطلبات Backend
```bash
cd /var/www/hosptal
npm install --production
```

#### 5.2 تثبيت متطلبات Frontend
```bash
cd /var/www/hosptal/client
npm install
npm run build
```

### الخطوة 6: تحديث قاعدة البيانات

#### 6.1 تحديث db.js لدعم MySQL
```bash
# تأكد من تثبيت mysql2
cd /var/www/hosptal
npm install mysql2
```

#### 6.2 تعديل server/database/db.js
يجب تحديث الملف ليدعم MySQL بناءً على DB_TYPE في .env

### الخطوة 7: إعداد Nginx

#### 7.1 إنشاء ملف إعدادات Nginx
```bash
sudo nano /etc/nginx/sites-available/hospital
```

#### 7.2 إضافة التكوين التالي:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (React)
    location / {
        root /var/www/hosptal/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # ملفات الرفع
    location /uploads {
        alias /var/www/hosptal/uploads;
    }
}
```

#### 7.3 تفعيل الموقع
```bash
sudo ln -s /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### الخطوة 8: تشغيل التطبيق باستخدام PM2

#### 8.1 إنشاء ملف ecosystem.config.js
```bash
cd /var/www/hosptal
nano ecosystem.config.js
```

#### 8.2 إضافة التكوين:
```javascript
module.exports = {
  apps: [{
    name: 'hospital-api',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

#### 8.3 تشغيل التطبيق
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### الخطوة 9: إعداد SSL (HTTPS)

#### 9.1 تثبيت Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

#### 9.2 الحصول على شهادة SSL
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### الخطوة 10: إعدادات الأمان

#### 10.1 إعداد Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### 10.2 تحديث Helmet في server/index.js
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## الصيانة والتحديثات

### إعادة تشغيل التطبيق
```bash
pm2 restart hospital-api
```

### عرض السجلات
```bash
pm2 logs hospital-api
```

### تحديث التطبيق
```bash
cd /var/www/hosptal
git pull
cd client
npm run build
pm2 restart hospital-api
```

### نسخ احتياطي لقاعدة البيانات
```bash
mysqldump -u hospital_user -p hospital_db > backup_$(date +%Y%m%d).sql
```

## استكشاف الأخطاء

### التحقق من حالة التطبيق
```bash
pm2 status
pm2 logs hospital-api --lines 50
```

### التحقق من Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
```

### التحقق من MySQL
```bash
sudo systemctl status mysql
mysql -u hospital_user -p hospital_db
```

## ملاحظات مهمة

1. **تغيير كلمات المرور الافتراضية**: تأكد من تغيير جميع كلمات المرور الافتراضية
2. **JWT_SECRET**: استخدم مفتاح قوي وعشوائي
3. **النسخ الاحتياطي**: قم بعمل نسخ احتياطي منتظم لقاعدة البيانات
4. **التحديثات**: حافظ على تحديث النظام والاعتماديات
5. **المراقبة**: راقب استخدام الموارد (CPU، RAM، Disk)

## الدعم

إذا واجهت أي مشاكل، راجع:
- سجلات PM2: `pm2 logs`
- سجلات Nginx: `sudo tail -f /var/log/nginx/error.log`
- سجلات التطبيق: `./logs/`
