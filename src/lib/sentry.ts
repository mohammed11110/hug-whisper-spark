import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  });
  initialized = true;
}

export function setSentryUser(user: { id: string; email?: string } | null) {
  if (!initialized) return;
  if (user) Sentry.setUser({ id: user.id, email: user.email });
  else Sentry.setUser(null);
}

export function captureError(err: unknown, context?: Record<string, any>) {
  console.error("[captureError]", err, context);
  if (!initialized) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export { Sentry };
