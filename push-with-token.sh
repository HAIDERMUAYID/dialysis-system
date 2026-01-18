#!/bin/bash

echo "🚀 رفع المشروع باستخدام Personal Access Token"
echo ""
echo "⚠️  ستحتاج إلى إدخال الـ Token مرة واحدة فقط"
echo ""

# قراءة الـ Token من المستخدم
read -sp "أدخل Personal Access Token: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ لم يتم إدخال Token"
    exit 1
fi

# إعداد remote مع Token
echo "⚙️  إعداد المصادقة..."
git remote set-url origin https://${TOKEN}@github.com/HAIDERMUAYID/dialysis-system.git

# محاولة الرفع
echo "📤 جاري الرفع..."
if git push --set-upstream origin main; then
    echo ""
    echo "✅ تم الرفع بنجاح!"
    echo "🌐 المشروع متاح على: https://github.com/HAIDERMUAYID/dialysis-system"
    echo ""
    echo "⚠️  تم حفظ الـ Token في إعدادات Git"
    echo "   لإزالته: git remote set-url origin https://github.com/HAIDERMUAYID/dialysis-system.git"
else
    echo ""
    echo "❌ فشل الرفع"
    echo "   تحقق من صحة الـ Token وصلاحياته"
fi
