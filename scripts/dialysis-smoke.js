#!/usr/bin/env node
/**
 * فحص سريع لواجهات الغسل الكلوي (D-IRS) بعد تشغيل الخادم.
 *
 * الاستخدام:
 *   npm run dialysis:smoke
 *   SMOKE_BASE_URL=http://localhost:5001 SMOKE_USER=admin SMOKE_PASS=123456 npm run dialysis:smoke
 */
require('dotenv').config();

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');
const USER = process.env.SMOKE_USER || 'admin';
const PASS = process.env.SMOKE_PASS || '123456';

const today = new Date().toISOString().slice(0, 10);
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed += 1;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(method, path, { token, body, query } = {}) {
  const url = new URL(path, BASE);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`\n🔬 فحص D-IRS — ${BASE}\n`);

  const health = await request('GET', '/api/health');
  if (health.status === 200 && health.data?.status === 'OK') {
    ok(`صحة الخادم (db: ${health.data.database ?? '—'})`);
  } else {
    fail('صحة الخادم', `HTTP ${health.status}`);
  }

  const login = await request('POST', '/api/auth/login', {
    body: { username: USER, password: PASS },
  });
  if (login.status !== 200 || !login.data?.token) {
    fail('تسجيل الدخول', login.data?.error || `HTTP ${login.status}`);
    console.log(`\n❌ توقف: تحقق من SMOKE_USER/SMOKE_PASS والخادم.\n`);
    process.exit(1);
  }
  ok('تسجيل الدخول');
  const token = login.data.token;

  const hospitals = await request('GET', '/api/dialysis/hospitals', { token });
  if (hospitals.status !== 200 || !Array.isArray(hospitals.data)) {
    fail('قائمة المستشفيات', `HTTP ${hospitals.status}`);
    process.exit(1);
  }
  ok(`قائمة المستشفيات (${hospitals.data.length})`);
  const hid = hospitals.data[0]?.id;
  if (!hid) {
    fail('مستشفى للاختبار', 'لا يوجد مستشفى نشط');
    process.exit(1);
  }

  const q = { hospital_id: hid };
  const qAll = { hospital_id: 'all_my' };

  const checks = [
    ['GET', '/api/dialysis/patients', q],
    ['GET', '/api/dialysis/locations', q],
    ['GET', '/api/dialysis/shift-slots', q],
    ['GET', '/api/dialysis/machines', q],
    ['GET', '/api/dialysis/warehouses', q],
    ['GET', '/api/dialysis/items', q],
    ['GET', '/api/dialysis/sessions', { ...q, limit: 5 }],
    ['GET', '/api/dialysis/sessions/active', q],
    ['GET', '/api/dialysis/access/permissions', {}],
    ['GET', '/api/dialysis/pharmacy/sessions', { hospital_id: hid, date_from: weekAgo, date_to: today }],
    ['GET', '/api/dialysis/pharmacy/inventory/overview', q],
    ['GET', '/api/dialysis/reconciliation', { hospital_id: hid, from: weekAgo, to: today }],
    ['GET', '/api/dialysis/patients', qAll],
  ];

  for (const [method, path, query] of checks) {
    const r = await request(method, path, { token, query });
    const name = `${method} ${path}`;
    if (r.status >= 200 && r.status < 300) {
      ok(name);
    } else if (r.status === 403 && path.includes('/access/')) {
      ok(`${name} (403 متوقع لغير المدير)`);
    } else {
      fail(name, `HTTP ${r.status} ${typeof r.data === 'object' ? r.data?.error : ''}`);
    }
  }

  console.log(`\n📊 النتيجة: ${passed} ناجح، ${failed} فاشل\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
