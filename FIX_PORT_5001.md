# حل مشكلة المنفذ 5001 مستخدم

## المشكلة
```
Port 5001 is already in use!
```

## الحل

### الحل 1: إيقاف العملية القديمة

```bash
kill -9 $(lsof -ti:5001)
```

ثم أعد تشغيل الخادم:
```bash
npm run server
```

### الحل 2: البحث عن العملية يدوياً

```bash
# البحث عن العملية
lsof -i:5001
```

ستحصل على output مثل:
```
COMMAND   PID    USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345  user    23u  IPv4  ...      0t0  TCP *:5001 (LISTEN)
```

ثم أوقف العملية:
```bash
kill -9 12345
```

### الحل 3: تغيير المنفذ

إذا أردت استخدام منفذ آخر:

1. **عدّل `.env`:**
   ```env
   PORT=5002
   ```

2. **أعد تشغيل الخادم:**
   ```bash
   npm run server
   ```

3. **تحديث Frontend:**
   - تأكد من أن Frontend يتصل بالمنفذ الصحيح

## التحقق من النجاح

بعد إيقاف العملية القديمة وإعادة التشغيل، يجب أن ترى:

```
Connected to database via Prisma
Default roles and users created successfully
Database initialized successfully
Server is running on port 5001
```

## ملاحظات

- إذا استمرت المشكلة، تأكد من إيقاف جميع عمليات Node.js:
  ```bash
  pkill -f node
  ```

- أو استخدم منفذ مختلف مؤقتاً
