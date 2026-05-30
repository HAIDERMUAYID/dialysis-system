/** اهتزاز خفيف عند التفاعلات المهمة (إن دعمه الجهاز) */
export function dialysisHaptic(pattern: 'tap' | 'success' | 'nav' = 'tap'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  const map = {
    tap: 10,
    nav: 12,
    success: [12, 40, 12] as number | number[],
  };
  try {
    navigator.vibrate(map[pattern]);
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
