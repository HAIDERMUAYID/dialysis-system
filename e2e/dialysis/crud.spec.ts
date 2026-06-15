import { test, expect } from '@playwright/test';
import {
  apiCreateEmergencyPatient,
  apiCreateSession,
  apiDeletePatient,
  apiDeleteSession,
  apiGetHospitals,
  apiGetLocations,
  apiLogin,
} from '../helpers/api';
import { seedBrowserAuth } from '../helpers/ui';

test.describe('D-IRS — مريض وجلسة', () => {
  test('login → patient → session → delete', async ({ page }) => {
    const session = await apiLogin();
    const hospitals = await apiGetHospitals(session.token);
    const hospitalId = hospitals[0].id;
    const locations = await apiGetLocations(session.token, hospitalId);

    const patientName = `E2E-${Date.now()}`;
    let patientId: number | null = null;
    let sessionId: number | null = null;

    try {
      const patient = await apiCreateEmergencyPatient(session.token, hospitalId, patientName);
      patientId = patient.id;

      const createdSession = await apiCreateSession(
        session.token,
        hospitalId,
        patientId,
        locations[0].id
      );
      sessionId = createdSession.id;

      await seedBrowserAuth(page, session, hospitalId);

      await page.goto('/dialysis/patients');
      await expect(page.getByPlaceholder(/بحث/i)).toBeVisible({ timeout: 30_000 });
      await page.getByPlaceholder(/بحث/i).fill(patientName);
      await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 15_000 });

      await page.goto('/dialysis/sessions');
      await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 20_000 });

      await apiDeleteSession(session.token, hospitalId, sessionId);
      sessionId = null;

      await apiDeletePatient(session.token, hospitalId, patientId);
      patientId = null;

      await page.goto('/dialysis/patients');
      await page.getByPlaceholder(/بحث/i).fill(patientName);
      await expect(page.getByText(patientName)).toHaveCount(0, { timeout: 10_000 });
    } finally {
      if (sessionId != null) {
        await apiDeleteSession(session.token, hospitalId, sessionId).catch(() => undefined);
      }
      if (patientId != null) {
        await apiDeletePatient(session.token, hospitalId, patientId).catch(() => undefined);
      }
    }
  });
});
