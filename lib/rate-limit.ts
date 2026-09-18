import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

function hashKey(action: string, key: string) {
  const pepper =
    process.env.SECURITY_PEPPER ||
    process.env.AUTH_SECRET ||
    "minha-escola-dev-rate-limit-pepper";

  return createHash("sha256")
    .update(action + ":" + key + ":" + pepper)
    .digest("hex");
}

export function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = (forwarded?.split(",")[0] || realIp || "unknown").trim();
  return ip.slice(0, 128);
}

export async function checkRateLimit(input: {
  action: string;
  key: string;
  limit: number;
  windowMs: number;
  blockMs: number;
}) {
  const now = new Date();
  const keyHash = hashKey(input.action, input.key);

  return prisma.$transaction(async (tx) => {
    // Força um UPDATE mesmo quando a linha já existe. No PostgreSQL o lock
    // permanece até o fim da transação, serializando rajadas concorrentes
    // para a mesma chave sem perder incrementos.
    await tx.securityThrottle.upsert({
      where: {
        action_keyHash: {
          action: input.action,
          keyHash,
        },
      },
      update: {
        updatedAt: now,
      },
      create: {
        action: input.action,
        keyHash,
        windowStart: now,
        count: 0,
      },
    });

    const current = await tx.securityThrottle.findUniqueOrThrow({
      where: {
        action_keyHash: {
          action: input.action,
          keyHash,
        },
      },
    });

    if (current.blockedUntil && current.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((current.blockedUntil.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    const windowExpired =
      now.getTime() - current.windowStart.getTime() >= input.windowMs;

    if (windowExpired) {
      await tx.securityThrottle.update({
        where: { id: current.id },
        data: {
          windowStart: now,
          count: 1,
          blockedUntil: null,
        },
      });

      return { allowed: true, retryAfterSeconds: 0 };
    }

    const nextCount = current.count + 1;
    const shouldBlock = nextCount > input.limit;
    const blockedUntil = shouldBlock
      ? new Date(now.getTime() + input.blockMs)
      : null;

    await tx.securityThrottle.update({
      where: { id: current.id },
      data: {
        count: nextCount,
        blockedUntil,
      },
    });

    return {
      allowed: !shouldBlock,
      retryAfterSeconds: shouldBlock
        ? Math.ceil(input.blockMs / 1000)
        : 0,
    };
  });
}

export async function clearRateLimit(action: string, key: string) {
  const keyHash = hashKey(action, key);

  await prisma.securityThrottle.deleteMany({
    where: { action, keyHash },
  });
}
