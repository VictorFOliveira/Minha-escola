import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function jsonMetadata(
  value?: Record<string, unknown> | null,
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function auditUserAction(input: {
  schoolId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.auditLog.create({
    data: {
      schoolId: input.schoolId,
      userId: input.userId,
      actorType: "USER",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      metadata: jsonMetadata(input.metadata),
    },
  });
}

export async function auditPlatformAction(input: {
  platformAdminId: string;
  schoolId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.auditLog.create({
    data: {
      schoolId: input.schoolId || null,
      platformAdminId: input.platformAdminId,
      actorType: "PLATFORM_ADMIN",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      metadata: jsonMetadata(input.metadata),
    },
  });
}

export async function auditSystemAction(input: {
  schoolId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.auditLog.create({
    data: {
      schoolId: input.schoolId || null,
      actorType: "SYSTEM",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      metadata: jsonMetadata(input.metadata),
    },
  });
}
