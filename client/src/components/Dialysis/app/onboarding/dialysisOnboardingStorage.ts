const TOUR_VERSION = 'v1';

export function onboardingStorageKey(userId: number | string | undefined): string {
  return `d-irs-onboarding-${TOUR_VERSION}-${userId ?? 'anon'}`;
}

export function isOnboardingTourDone(userId: number | string | undefined): boolean {
  try {
    return localStorage.getItem(onboardingStorageKey(userId)) === 'done';
  } catch {
    return false;
  }
}

export function markOnboardingTourDone(userId: number | string | undefined): void {
  try {
    localStorage.setItem(onboardingStorageKey(userId), 'done');
  } catch {
    /* ignore */
  }
}

export function clearOnboardingTourDone(userId: number | string | undefined): void {
  try {
    localStorage.removeItem(onboardingStorageKey(userId));
  } catch {
    /* ignore */
  }
}
