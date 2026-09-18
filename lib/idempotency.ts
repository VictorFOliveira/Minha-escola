import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/security-crypto";

export async function readIdempotency(
  request: Request,
  schoolId: string,
  operation: string,
) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return null;

  if (key.length > 200) {
    throw new Error("Idempotency-Key excede 200 caracteres.");
  }

  const keyHash = hashSecret(
    "idempotency:" + schoolId + ":" + operation + ":" + key,
  );

  const record = await prisma.idempotencyRecord.findUnique({
    where: {
      schoolId_operation_keyHash: {
        schoolId,
        operation,
        keyHash,
      },
    },
  });

  if (!record || record.expiresAt <= new Date()) return null;

  return {
    keyHash,
    responseStatus: record.responseStatus,
    responseBody: record.responseBody,
    resourceId: record.resourceId,
  };
}

export function idempotencyHash(
  request: Request,
  schoolId: string,
  operation: string,
) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return null;
  if (key.length > 200) throw new Error("Idempotency-Key inválida.");

  return hashSecret(
    "idempotency:" + schoolId + ":" + operation + ":" + key,
  );
}

export async function saveIdempotency(input: {
  schoolId: string;
  operation: string;
  keyHash: string | null;
  responseStatus: number;
  responseBody: unknown;
  resourceId?: string | null;
}) {
  if (!input.keyHash) return;

  await prisma.idempotencyRecord.upsert({
    where: {
      schoolId_operation_keyHash: {
        schoolId: input.schoolId,
        operation: input.operation,
        keyHash: input.keyHash,
      },
    },
    update: {
      responseStatus: input.responseStatus,
      responseBody: JSON.parse(
        JSON.stringify(input.responseBody),
      ) as Prisma.InputJsonValue,
      resourceId: input.resourceId || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    create: {
      schoolId: input.schoolId,
      operation: input.operation,
      keyHash: input.keyHash,
      responseStatus: input.responseStatus,
      responseBody: JSON.parse(
        JSON.stringify(input.responseBody),
      ) as Prisma.InputJsonValue,
      resourceId: input.resourceId || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}
