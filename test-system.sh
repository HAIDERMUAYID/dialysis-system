#!/bin/bash

# سكريبت اختبار شامل لنظام مستشفى الحكيم
# يستخدم curl لاختبار جميع الوظائف

API_URL="https://hospital-api-7v73.onrender.com"
FRONTEND_URL="https://hospital-frontend-wrxu.onrender.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# Test functions
test_health_check() {
    log_info "اختبار 1: Health Check"
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
    if [ "$response" = "200" ]; then
        log_success "Health Check"
        return 0
    else
        log_error "Health Check (HTTP $response)"
        return 1
    fi
}

test_login() {
    local username=$1
    local password=$2
    log_info "اختبار 2: تسجيل الدخول ($username)"
    
    response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    if echo "$response" | grep -q "token"; then
        TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        log_success "تسجيل الدخول ($username)"
        return 0
    else
        log_error "تسجيل الدخول ($username)"
        echo "Response: $response"
        return 1
    fi
}

test_add_patient() {
    log_info "اختبار 3: إضافة مريض جديد"
    
    response=$(curl -s -X POST "$API_URL/api/patients" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "name": "محمد أحمد - اختبار",
            "patient_category": "زراعة كلية",
            "gender": "ذكر",
            "date_of_birth": "1990-01-01",
            "age": 34,
            "blood_type": "A+",
            "phone": "07701234567",
            "city": "بغداد"
        }')
    
    if echo "$response" | grep -q "id"; then
        PATIENT_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        log_success "إضافة مريض جديد (ID: $PATIENT_ID)"
        return 0
    else
        log_error "إضافة مريض جديد"
        echo "Response: $response"
        return 1
    fi
}

test_search_patients() {
    log_info "اختبار 4: البحث عن المرضى"
    
    response=$(curl -s -X GET "$API_URL/api/patients?search=محمد" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q "محمد"; then
        log_success "البحث عن المرضى"
        return 0
    else
        log_error "البحث عن المرضى"
        return 1
    fi
}

test_create_visit() {
    log_info "اختبار 5: إنشاء زيارة جديدة"
    
    response=$(curl -s -X POST "$API_URL/api/visits" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"patient_id\": $PATIENT_ID}")
    
    if echo "$response" | grep -q "visit_number"; then
        VISIT_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        log_success "إنشاء زيارة جديدة (ID: $VISIT_ID)"
        return 0
    else
        log_error "إنشاء زيارة جديدة"
        echo "Response: $response"
        return 1
    fi
}

test_add_lab_test() {
    log_info "اختبار 6: إضافة تحليل للكتالوج"
    
    # Login as lab user
    lab_response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"lab","password":"lab123"}')
    
    LAB_TOKEN=$(echo "$lab_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$LAB_TOKEN" ]; then
        log_warning "لا يمكن الحصول على token للمختبر - قد يحتاج صلاحيات lab_manager"
        return 1
    fi
    
    response=$(curl -s -X POST "$API_URL/api/lab/catalog" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $LAB_TOKEN" \
        -d '{
            "test_name": "Blood Test - Test",
            "test_name_ar": "تحليل الدم - اختبار",
            "unit": "g/dL",
            "normal_range_min": "12",
            "normal_range_max": "15",
            "normal_range_text": "12-15 g/dL"
        }')
    
    if echo "$response" | grep -q "id"; then
        TEST_ID=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        log_success "إضافة تحليل للكتالوج (ID: $TEST_ID)"
        return 0
    else
        log_error "إضافة تحليل للكتالوج"
        echo "Response: $response"
        return 1
    fi
}

test_get_lab_catalog() {
    log_info "اختبار 7: جلب كتالوج التحاليل"
    
    response=$(curl -s -X GET "$API_URL/api/lab/catalog" \
        -H "Authorization: Bearer $LAB_TOKEN")
    
    if echo "$response" | grep -q "test_name"; then
        log_success "جلب كتالوج التحاليل"
        return 0
    else
        log_error "جلب كتالوج التحاليل"
        return 1
    fi
}

test_get_visit_details() {
    log_info "اختبار 8: جلب تفاصيل الزيارة"
    
    response=$(curl -s -X GET "$API_URL/api/visits/$VISIT_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$response" | grep -q "visit_number"; then
        log_success "جلب تفاصيل الزيارة"
        return 0
    else
        log_error "جلب تفاصيل الزيارة"
        return 1
    fi
}

test_api_info() {
    log_info "اختبار 9: معلومات API"
    
    response=$(curl -s -X GET "$API_URL/api/info")
    
    if echo "$response" | grep -q "version"; then
        log_success "معلومات API"
        return 0
    else
        log_error "معلومات API"
        return 1
    fi
}

# Main execution
echo ""
echo "============================================================"
echo "🚀 بدء الاختبار الشامل لنظام مستشفى الحكيم"
echo "============================================================"
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Run tests
test_health_check
test_login "inquiry" "inquiry123"

if [ -n "$TOKEN" ]; then
    test_add_patient
    test_search_patients
    
    if [ -n "$PATIENT_ID" ]; then
        test_create_visit
        test_get_visit_details
    fi
    
    test_add_lab_test
    if [ -n "$LAB_TOKEN" ]; then
        test_get_lab_catalog
    fi
fi

test_api_info

# Print summary
echo ""
echo "============================================================"
echo "📊 ملخص نتائج الاختبار"
echo "============================================================"
echo -e "${GREEN}✅ نجحت: $PASSED${NC}"
echo -e "${RED}❌ فشلت: $FAILED${NC}"
echo -e "${YELLOW}⚠️  تحذيرات: $WARNINGS${NC}"

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
    echo -e "${BLUE}📈 نسبة النجاح: ${SUCCESS_RATE}%${NC}"
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 جميع الاختبارات نجحت! النظام جاهز للتسليم.${NC}"
else
    echo -e "${YELLOW}⚠️  بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.${NC}"
fi
echo "============================================================"
