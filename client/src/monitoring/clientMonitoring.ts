/** Minimal surface used by clientMonitoring — avoids tight coupling to Sentry types */
interface ClientSentry {
  init(options: {
    dsn: string;
    environment?: string;
    tracesSampleRate?: number;
    sendDefaultPii?: boolean;
  }): void;
  captureException(error: unknown, context?: { extra?: Record<string, unknown> }): void;
  captureMessage(
    message: string,
    context?: { level?: string; extra?: Record<string, unknown> }
  ): void;
}

let sentry: ClientSentry | null = null;

export async function initClientMonitoring(): Promise<void> {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) return;
  try {
    const mod = (await import('@sentry/react')) as ClientSentry;
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    sentry = mod;
  } catch (err) {
    console.warn('Sentry init skipped:', err);
  }
}

export function reportClientError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (sentry) {
    sentry.captureException(error, { extra: context });
  } else if (process.env.NODE_ENV !== 'production') {
    console.error('[client-error]', error, context);
  }
}

export function reportClientMessage(
  message: string,
  context?: Record<string, unknown>
): void {
  if (sentry) {
    sentry.captureMessage(message, { level: 'warning', extra: context });
  }
}
