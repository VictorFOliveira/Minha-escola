export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  error: unknown,
  request: {
    path?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind?: string;
    routePath?: string;
    routeType?: string;
    renderSource?: string;
  },
) {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");

  Sentry.captureException(error, {
    tags: {
      route: context.routePath || request.path || "unknown",
      routerKind: context.routerKind || "unknown",
      routeType: context.routeType || "unknown",
    },
    extra: {
      method: request.method,
      renderSource: context.renderSource,
    },
  });
}
