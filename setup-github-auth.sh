#!/bin/bash

echo "🔐 إعداد مصادقة GitHub"
echo ""

# إعداد Git إذا لم يكن معرّفاً
if ! git config user.name > /dev/null 2>&1; then
    echo "⚙️  إعداد Git..."
    git config user.name "Haider Muayid"
    git config user.email "haider.m@example.com"
fi

echo "📋 الخطوات التالية:"
echo ""
echo "1️⃣  اذهب إلى: https://github.com/settings/tokens"
echo "2️⃣  اضغط 'Generate new token (classic)'"
echo "3️⃣  اختر صلاحيات 'repo'"
echo "4️⃣  انسخ الـ Token"
echo ""
echo "5️⃣  ثم شغّل:"
echo "   git push --set-upstream origin main"
echo ""
echo "   عندما يُطلب منك:"
echo "   - Username: HAIDERMUAYID"
echo "   - Password: الصق الـ Token"
echo ""

# محاولة مسح بيانات المصادقة القديمة
echo "🧹 تنظيف بيانات المصادقة القديمة..."
git credential-osxkeychain erase <<EOF
host=github.com
protocol=https
EOF

echo ""
echo "✅ جاهز! الآن شغّل: git push --set-upstream origin main"
