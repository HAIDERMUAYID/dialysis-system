import axios from 'axios';
import {
  captureFacePortraitBlob,
  captureVideoCenterPortraitBlob,
} from '../face/dialysisFaceRuntime';

export async function blobToJpegDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function uploadDialysisPatientPortraitBlob(
  patientId: number,
  hospitalId: number,
  blob: Blob
): Promise<string | null> {
  const portraitBase64 = await blobToJpegDataUrl(blob);
  if (!portraitBase64) return null;

  const { data } = await axios.post<{ photo_url?: string; photoUrl?: string }>(
    `/api/dialysis/patients/${patientId}/photo-data`,
    {
      hospital_id: hospitalId,
      portrait_jpeg_base64: portraitBase64,
    }
  );
  return data.photoUrl || data.photo_url || null;
}

export async function uploadDialysisPatientPortrait(
  patientId: number,
  hospitalId: number,
  video: HTMLVideoElement,
  mirrored = false
): Promise<string | null> {
  const blob =
    (await captureVideoCenterPortraitBlob(video, mirrored)) ||
    (await captureFacePortraitBlob(video, mirrored));
  if (!blob) return null;
  return uploadDialysisPatientPortraitBlob(patientId, hospitalId, blob);
}

export async function ensureDialysisPatientPortrait(
  patientId: number,
  hospitalId: number,
  portraitBlob: Blob | null,
  hasPhoto: boolean
): Promise<string | null> {
  if (hasPhoto || !portraitBlob) return null;
  try {
    return await uploadDialysisPatientPortraitBlob(patientId, hospitalId, portraitBlob);
  } catch (err) {
    console.warn('Dialysis patient portrait upload failed:', err);
    return null;
  }
}

/** يدعم photoUrl و photo_url من الاستجابة */
export function sessionPatientPhotoUrl(
  patient?: { photoUrl?: string | null; photo_url?: string | null } | null
): string | null | undefined {
  return patient?.photoUrl ?? patient?.photo_url ?? null;
}
