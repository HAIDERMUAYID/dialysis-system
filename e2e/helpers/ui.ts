import type { Page } from '@playwright/test';
import { E2E_PASS, E2E_USER } from './env';
import type { AuthSession } from './api';

export async function loginViaDialysisPage(page: Page): Promise<void> {
  await page.goto('/dialysis-login');
  await page.getByPlaceholder('اسم المستخدم').fill(E2E_USER);
  await page.getByPlaceholder('كلمة المرور').fill(E2E_PASS);
  await page.getByRole('button', { name: /تسجيل الدخول/i }).click();
  await page.waitForURL(/\/dialysis(\/|$|\?)/, { timeout: 30_000 });
}

export async function seedBrowserAuth(
  page: Page,
  session: AuthSession,
  hospitalId: number
): Promise<void> {
  await page.addInitScript(
    ({ token, user, hospitalId: hid }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('dialysis_hospital_id', String(hid));
    },
    { token: session.token, user: session.user, hospitalId }
  );
}

export async function gotoDialysisPage(page: Page, path: string): Promise<void> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  await page.goto(`/dialysis${normalized === '/dialysis' ? '' : normalized.replace(/^\/dialysis/, '')}`);
}

export async function expectPageHeading(page: Page, title: string | RegExp): Promise<void> {
  await page.locator('.d-dialysis-page-header h2, .d-page-header h2').filter({ hasText: title }).first().waitFor({
    state: 'visible',
  });
}
