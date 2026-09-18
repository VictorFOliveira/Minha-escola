import { prisma } from "@/lib/prisma";

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
      metadata: input.metadata || undefined,
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
      metadata: input.metadata || undefined,
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
      metadata: input.metadata || undefined,
    },
  });
}
