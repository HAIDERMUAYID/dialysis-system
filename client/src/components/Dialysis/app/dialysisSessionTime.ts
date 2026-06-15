import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { getBaghdadTime } from '../../../utils/dayjs-config';

dayjs.extend(utc);
dayjs.extend(timezone);

const BAGHDAD = 'Asia/Baghdad';

/** دمج تاريخ الجلسة (تقويم بغداد) مع وقت البد — ISO UTC للـ API */
export function mergeSessionDateWithStartTimeBaghdad(sessionDate: Dayjs, timeOnly: Dayjs): string {
  const ymd = sessionDate.format('YYYY-MM-DD');
  const hh = String(timeOnly.hour()).padStart(2, '0');
  const mm = String(timeOnly.minute()).padStart(2, '0');
  const ss = String(timeOnly.second()).padStart(2, '0');
  return dayjs.tz(`${ymd}T${hh}:${mm}:${ss}`, BAGHDAD).toISOString();
}

export function baghdadTodayYmd(): string {
  return getBaghdadTime().format('YYYY-MM-DD');
}

export { getBaghdadTime };

export function isSessionDateFutureBaghdad(sessionDate: Dayjs): boolean {
  return sessionDate.format('YYYY-MM-DD') > baghdadTodayYmd();
}

export function isSessionStartFutureBaghdad(sessionDate: Dayjs, timeOnly: Dayjs): boolean {
  const iso = mergeSessionDateWithStartTimeBaghdad(sessionDate, timeOnly);
  return dayjs(iso).isAfter(getBaghdadTime());
}
