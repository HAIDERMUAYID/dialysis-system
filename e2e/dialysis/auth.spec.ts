import { test, expect } from '@playwright/test';
import { loginViaDialysisPage } from '../helpers/ui';

test.describe('D-IRS — تسجيل الدخول', () => {
  test('يدخل admin إلى وحدة الغسل', async ({ page }) => {
    await loginViaDialysisPage(page);
    await expect(page).toHaveURL(/\/dialysis/);
    await expect(page.locator('.d-app-root, .d-app-content').first()).toBeVisible();
  });
});
