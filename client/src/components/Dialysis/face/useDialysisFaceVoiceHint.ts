import { useEffect, useRef } from 'react';
import { speakDialysisFaceHint, stopDialysisFaceVoice } from './dialysisFaceVoice';

/**
 * ينطق التلميح عند تغيّره (مع تأخير بسيط لتجنب التقطيع).
 */
export function useDialysisFaceVoiceHint(
  text: string | undefined,
  enabled: boolean,
  debounceMs = 600
): void {
  const timerRef = useRef<number | undefined>();

  useEffect(() => {
    if (!enabled || !text?.trim()) return;
    timerRef.current = window.setTimeout(() => {
      speakDialysisFaceHint(text);
    }, debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [text, enabled, debounceMs]);

  useEffect(() => {
    if (!enabled) stopDialysisFaceVoice();
    return () => stopDialysisFaceVoice();
  }, [enabled]);
}
