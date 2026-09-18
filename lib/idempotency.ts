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
    return {
      keyHash: null,
      responseStatus: 400,
      responseBody: { error: "Idempotency-Key excede 200 caracteres." },
      resourceId: null,
    };
  }

  const keyHash = hashSecret(
    "idempotency:" + schoolId + ":" + operation + ":" + key,
  );
  const where = {
    schoolId_operation_keyHash: {
      schoolId,
      operation,
      keyHash,
    },
  };
  const now = new Date();

  let record = await prisma.idempotencyRecord.findUnique({ where });

  if (record?.expiresAt && record.expiresAt <= now) {
    await prisma.idempotencyRecord.deleteMany({
      where: {
        id: record.id,
        expiresAt: { lte: now },
      },
    });
    record = null;
  }

  if (!record) {
    const claimed = await prisma.idempotencyRecord.createMany({
      data: [
        {
          schoolId,
          operation,
          keyHash,
          responseStatus: null,
          resourceId: null,
          // Reserva curta enquanto a primeira requisição está executando.
          // saveIdempotency estende para 24 h ao persistir a resposta.
          expiresAt: new Date(Date.now() + 30 * 1000),
        },
      ],
      skipDuplicates: true,
    });

    if (claimed.count === 1) {
      return null;
    }

    record = await prisma.idempotencyRecord.findUnique({ where });
  }

  if (
    record?.responseStatus !== null &&
    record?.responseStatus !== undefined &&
    record.responseBody !== null
  ) {
    return {
      keyHash,
      responseStatus: record.responseStatus,
      responseBody: record.responseBody,
      resourceId: record.resourceId,
    };
  }

  // Outra requisição com a mesma chave pode estar executando neste instante.
  // Aguarda uma janela curta para que ela grave a resposta e então faz replay.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const pending = await prisma.idempotencyRecord.findUnique({ where });
    if (!pending) return null;

    if (
      pending.responseStatus !== null &&
      pending.responseStatus !== undefined &&
      pending.responseBody !== null
    ) {
      return {
        keyHash,
        responseStatus: pending.responseStatus,
        responseBody: pending.responseBody,
        resourceId: pending.resourceId,
      };
    }
  }

  return {
    keyHash,
    responseStatus: 409,
    responseBody: {
      error: "Requisição idempotente ainda está em processamento.",
    },
    resourceId: null,
  };
}

export function idempotencyHash(
  request: Request,
  schoolId: string,
  operation: string,
) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return null;
  if (key.length > 200) return null;

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
