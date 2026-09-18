import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { requestSecurityContext } from "@/lib/security-events";

export const PLATFORM_COOKIE = "minha_escola_platform_session";
const DURATION_SECONDS = 60 * 60 * 4;

function secret() {
  const configured =
    process.env.PLATFORM_AUTH_SECRET || process.env.AUTH_SECRET;

  if (configured && configured.length >= 32) {
    return new TextEncoder().encode(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PLATFORM_AUTH_SECRET ou AUTH_SECRET deve possuir 32+ caracteres.",
    );
  }

  return new TextEncoder().encode(
    "minha-escola-platform-dev-secret-change-me-2026",
  );
}

async function currentSessionId() {
  const store = await cookies();
  const token = store.get(PLATFORM_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

export async function createPlatformSession(
  input: {
    id: string;
    email: string;
    name: string;
  },
  options?: {
    request?: Request;
    mfaVerified?: boolean;
  },
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DURATION_SECONDS * 1000);
  const context = requestSecurityContext(options?.request);

  const stored = await prisma.platformSession.create({
    data: {
      platformAdminId: input.id,
      expiresAt,
      lastSeenAt: now,
      userAgent: context.userAgent,
      ipHash: context.ipHash,
      mfaVerified: options?.mfaVerified !== false,
    },
  });

  const token = await new SignJWT({ sid: stored.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.id)
    .setIssuedAt()
    .setExpirationTime(DURATION_SECONDS + "s")
    .sign(secret());

  const store = await cookies();
  store.set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: DURATION_SECONDS,
  });

  return stored.id;
}

export async function destroyPlatformSession() {
  const sessionId = await currentSessionId();

  if (sessionId) {
    await prisma.platformSession
      .updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })
      .catch(() => null);
  }

  const store = await cookies();
  store.delete(PLATFORM_COOKIE);
}

export async function revokeAllPlatformSessions(
  platformAdminId: string,
  exceptSessionId?: string | null,
) {
  await prisma.platformSession.updateMany({
    where: {
      platformAdminId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function getPlatformSession() {
  const store = await cookies();
  const token = store.get(PLATFORM_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const stored = await prisma.platformSession.findFirst({
      where: {
        id: payload.sid,
        platformAdminId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { platformAdmin: true },
    });

    if (!stored?.platformAdmin.active) return null;

    if (
      Date.now() - stored.lastSeenAt.getTime() >
      5 * 60 * 1000
    ) {
      await prisma.platformSession
        .update({
          where: { id: stored.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => null);
    }

    return {
      id: stored.platformAdmin.id,
      name: stored.platformAdmin.name,
      email: stored.platformAdmin.email,
      sessionId: stored.id,
      mfaVerified: stored.mfaVerified,
    };
  } catch {
    return null;
  }
}

export async function requirePlatformSession() {
  const session = await getPlatformSession();
  if (!session) redirect("/superadmin/login");
  return session;
}
