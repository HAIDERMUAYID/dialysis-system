#!/bin/bash

# سكريبت لرفع المشروع على GitHub

echo "🚀 محاولة رفع المشروع على GitHub..."
echo ""

# التحقق من وجود commits
if ! git log --oneline -1 > /dev/null 2>&1; then
    echo "❌ لا توجد commits للرفع"
    exit 1
fi

echo "✅ تم العثور على commits"
echo ""

# محاولة الرفع
echo "📤 جاري الرفع..."
echo ""
echo "⚠️  إذا طُلب منك إدخال بيانات:"
echo "   - Username: اسم المستخدم على GitHub"
echo "   - Password: Personal Access Token (ليس كلمة المرور العادية)"
echo ""

# محاولة الرفع
if git push --set-upstream origin main 2>&1; then
    echo ""
    echo "✅ تم الرفع بنجاح!"
    echo "🌐 يمكنك رؤية المشروع على: https://github.com/HAIDERMUAYID/dialysis-system"
else
    echo ""
    echo "❌ فشل الرفع"
    echo ""
    echo "💡 الحلول المقترحة:"
    echo "   1. تأكد من وجود Personal Access Token"
    echo "   2. جرب استخدام SSH:"
    echo "      git remote set-url origin git@github.com:HAIDERMUAYID/dialysis-system.git"
    echo "      git push --set-upstream origin main"
    echo "   3. أو استخدم GitHub CLI: gh auth login"
fi
