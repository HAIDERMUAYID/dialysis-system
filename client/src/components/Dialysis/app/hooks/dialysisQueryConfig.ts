import { QueryClient } from 'react-query';

/** بيانات الغسل تُعتبر طازجة 30 ثانية — يقلّل الطلبات المكررة عند التنقل بين الصفحات */
export const DIALYSIS_STALE_TIME_MS = 30_000;

export const dialysisQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DIALYSIS_STALE_TIME_MS,
      refetchOnWindowFocus: true,
      retry: (failureCount) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
        return failureCount < 1;
      },
    },
  },
});
