import { useEffect, useState } from 'react';

/** أقل من 992px = وضع هاتف/تابلت (يتوافق مع تخطيط DialysisAppLayout) */
export const DIALYSIS_MOBILE_MQ = '(max-width: 991px)';

export function useDialysisMobile(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DIALYSIS_MOBILE_MQ).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(DIALYSIS_MOBILE_MQ);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return narrow;
}
