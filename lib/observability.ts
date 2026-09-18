export function structuredLog(input: {
  level: "info" | "warn" | "error";
  message: string;
  requestId?: string | null;
  schoolId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    timestamp: new Date().toISOString(),
    service: "minha-escola",
    level: input.level,
    message: input.message,
    requestId: input.requestId || undefined,
    schoolId: input.schoolId || undefined,
    userId: input.userId || undefined,
    ...input.metadata,
  };

  const line = JSON.stringify(payload);

  if (input.level === "error") console.error(line);
  else if (input.level === "warn") console.warn(line);
  else console.info(line);
}

export async function captureOperationalError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  structuredLog({
    level: "error",
    message:
      error instanceof Error ? error.message : "Operational error",
    metadata: context,
  });

  if (!process.env.SENTRY_DSN) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, { extra: context });
  } catch {
    // Logging must never break the application path.
  }
}
