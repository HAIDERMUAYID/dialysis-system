import { test, expect } from '@playwright/test';
import {
  apiGetHospitals,
  apiLogin,
  type AuthSession,
} from '../helpers/api';
import { expectPageHeading, seedBrowserAuth } from '../helpers/ui';

test.describe('D-IRS — التنقل', () => {
  let session: AuthSession;
  let hospitalId: number;

  test.beforeAll(async () => {
    session = await apiLogin();
    const hospitals = await apiGetHospitals(session.token);
    hospitalId = hospitals[0].id;
  });

  test.beforeEach(async ({ page }) => {
    await seedBrowserAuth(page, session, hospitalId);
  });

  const pages: Array<{ path: string; heading: string | RegExp }> = [
    { path: '', heading: 'نظرة عامة' },
    { path: '/patients', heading: 'المرضى' },
    { path: '/sessions', heading: 'الجلسات' },
    { path: '/live', heading: /القاعة/ },
    { path: '/reports', heading: 'التقارير' },
    { path: '/halls', heading: 'القاعات والأسرة' },
  ];

  for (const item of pages) {
    test(`صفحة ${item.path || 'overview'} تُحمّل`, async ({ page }) => {
      await page.goto(`/dialysis${item.path}`);
      await expect(page.locator('.d-app-content').first()).toBeVisible({ timeout: 30_000 });
      await expectPageHeading(page, item.heading);
    });
  }
});
