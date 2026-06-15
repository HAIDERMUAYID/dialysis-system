import axios from 'axios';
import {
  enrollQueueAdd,
  enrollQueueList,
  enrollQueueRemove,
  type QueuedFaceEnroll,
} from './dialysisOfflineDb';
import { isNetworkError, setDialysisPendingEnrollCount } from './dialysisOfflineState';

export async function refreshEnrollQueueCount(): Promise<number> {
  const items = await enrollQueueList();
  setDialysisPendingEnrollCount(items.length);
  return items.length;
}

export async function queueFaceEnroll(item: {
  patientId: number;
  hospitalId: number;
  payload: Record<string, unknown>;
}): Promise<void> {
  await enrollQueueAdd(item);
  await refreshEnrollQueueCount();
}

async function submitQueuedItem(item: QueuedFaceEnroll): Promise<void> {
  await axios.post(`/api/dialysis/patients/${item.patientId}/face-enroll`, item.payload);
}

export async function flushDialysisFaceEnrollQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const items = await enrollQueueList();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await submitQueuedItem(item);
      await enrollQueueRemove(item.id);
      synced += 1;
    } catch (err) {
      if (isNetworkError(err)) break;
      failed += 1;
      await enrollQueueRemove(item.id);
    }
  }

  await refreshEnrollQueueCount();
  return { synced, failed };
}
