import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ALL_MY_HOSPITALS, type DialysisHospitalScope } from '../dialysisContext';

const FALLBACK_POLL_MS = 60_000;
const SOCKET_FAILOVER_MS = 4000;

function resolveSocketUrl(): string {
  const env = process.env.REACT_APP_API_URL;
  if (env) return env.replace(/\/$/, '');
  return window.location.origin;
}

function resolveHospitalIds(
  hospitalId: DialysisHospitalScope | null,
  hospitals: { id: number }[]
): number[] {
  if (hospitalId == null) return [];
  if (hospitalId === ALL_MY_HOSPITALS) return hospitals.map((h) => h.id);
  return [hospitalId];
}

export type DialysisLiveTransport = 'socket' | 'sse' | 'poll';

/**
 * Subscribes to live-hall updates (WebSocket → SSE → slow poll fallback).
 */
export function useDialysisLiveSync(options: {
  hospitalId: DialysisHospitalScope | null;
  hospitals: { id: number }[];
  onChange: () => void;
  enabled?: boolean;
  onTransportChange?: (transport: DialysisLiveTransport) => void;
}) {
  const { hospitalId, hospitals, onChange, enabled = true, onTransportChange } = options;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTransportRef = useRef(onTransportChange);
  onTransportRef.current = onTransportChange;
  const hospitalIds = resolveHospitalIds(hospitalId, hospitals);
  const hospitalKey = hospitalIds.join(',');

  useEffect(() => {
    if (!enabled || hospitalIds.length === 0) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let disposed = false;
    let pollTimer: number | undefined;
    let sse: EventSource | null = null;
    let socket: Socket | null = null;
    let activeTransport: DialysisLiveTransport = 'socket';

    const setTransport = (next: DialysisLiveTransport) => {
      if (activeTransport === next) return;
      activeTransport = next;
      onTransportRef.current?.(next);
    };

    const trigger = () => {
      if (!disposed) onChangeRef.current();
    };

    const startFallbackPoll = () => {
      if (pollTimer) return;
      setTransport('poll');
      pollTimer = window.setInterval(trigger, FALLBACK_POLL_MS);
    };

    const startSse = () => {
      if (sse || disposed) return;
      const params = new URLSearchParams({ token });
      if (hospitalId === ALL_MY_HOSPITALS) {
        params.set('hospital_id', ALL_MY_HOSPITALS);
      } else if (hospitalIds[0]) {
        params.set('hospital_id', String(hospitalIds[0]));
      }
      sse = new EventSource(`/api/dialysis/live/stream?${params.toString()}`);
      sse.addEventListener('dialysis:live:changed', trigger);
      sse.onerror = () => {
        sse?.close();
        sse = null;
        startFallbackPoll();
      };
      setTransport('sse');
    };

    socket = io(resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    const failTimer = window.setTimeout(() => {
      if (disposed || activeTransport !== 'socket') return;
      if (!socket?.connected) {
        socket?.disconnect();
        socket = null;
        startSse();
      }
    }, SOCKET_FAILOVER_MS);

    socket.on('connect', () => {
      clearTimeout(failTimer);
      setTransport('socket');
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
      if (sse) {
        sse.close();
        sse = null;
      }
      socket?.emit('dialysis:live:subscribe', { hospitalIds });
    });

    socket.on('dialysis:live:changed', trigger);

    socket.on('connect_error', () => {
      if (disposed) return;
      socket?.disconnect();
      socket = null;
      startSse();
    });

    socket.io.on('reconnect_failed', () => {
      if (disposed) return;
      startSse();
    });

    return () => {
      disposed = true;
      clearTimeout(failTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      sse?.close();
      socket?.emit('dialysis:live:unsubscribe');
      socket?.disconnect();
    };
  }, [enabled, hospitalId, hospitalKey]);
}
