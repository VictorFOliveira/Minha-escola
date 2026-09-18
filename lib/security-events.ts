import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/security-crypto";

function jsonMetadata(
  value?: Record<string, unknown> | null,
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function requestSecurityContext(request?: Request) {
  if (!request) {
    return {
      ipHash: null,
      userAgent: null,
      requestId: null,
    };
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const rawIp = (forwarded?.split(",")[0] || realIp || "").trim();

  return {
    ipHash: rawIp ? hashSecret("ip:" + rawIp) : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    requestId: request.headers.get("x-request-id")?.slice(0, 100) || null,
  };
}

export async function recordUserSecurityEvent(input: {
  schoolId: string;
  userId?: string | null;
  eventType: string;
  severity?: "INFO" | "WARN" | "CRITICAL";
  request?: Request;
  metadata?: Record<string, unknown> | null;
}) {
  const context = requestSecurityContext(input.request);

  return prisma.securityEvent.create({
    data: {
      schoolId: input.schoolId,
      userId: input.userId || null,
      eventType: input.eventType,
      severity: input.severity || "INFO",
      ...context,
      metadata: jsonMetadata(input.metadata),
    },
  });
}

export async function recordPlatformSecurityEvent(input: {
  platformAdminId?: string | null;
  schoolId?: string | null;
  eventType: string;
  severity?: "INFO" | "WARN" | "CRITICAL";
  request?: Request;
  metadata?: Record<string, unknown> | null;
}) {
  const context = requestSecurityContext(input.request);

  return prisma.securityEvent.create({
    data: {
      schoolId: input.schoolId || null,
      platformAdminId: input.platformAdminId || null,
      eventType: input.eventType,
      severity: input.severity || "INFO",
      ...context,
      metadata: jsonMetadata(input.metadata),
    },
  });
}
