import { prefersReducedMotion } from '../app/useDialysisHaptic';

const STORAGE_KEY = 'd-irs-voice-hints';

let lastSpoken = '';
let lastSpokenAt = 0;

export function isDialysisFaceVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setDialysisFaceVoiceEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!enabled && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function pickArabicVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.startsWith('ar')) ??
    voices.find((v) => /arab/i.test(v.name)) ??
    voices[0]
  );
}

/**
 * نطق تلميح عربي قصير أثناء تسجيل/تعرف الوجه.
 * يُهمل التكرار السريع لنفس النص.
 */
export function speakDialysisFaceHint(text: string, options?: { force?: boolean }): void {
  if (!text.trim()) return;
  if (!options?.force && !isDialysisFaceVoiceEnabled()) return;
  if (prefersReducedMotion()) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const now = Date.now();
  if (!options?.force && text === lastSpoken && now - lastSpokenAt < 4500) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar';
  utterance.rate = 0.92;
  utterance.pitch = 1;
  const voice = pickArabicVoice();
  if (voice) utterance.voice = voice;

  lastSpoken = text;
  lastSpokenAt = now;
  window.speechSynthesis.speak(utterance);
}

export function stopDialysisFaceVoice(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  lastSpoken = '';
  lastSpokenAt = 0;
}
