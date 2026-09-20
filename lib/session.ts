import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { isAppRole, type AppRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requestSecurityContext } from "@/lib/security-events";
import { schoolIdForHost } from "@/lib/tenant-domain";

export const SESSION_COOKIE = "minha_escola_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type SessionUser = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  email: string;
  role: AppRole;
  enrollmentId?: string | null;
  guardianId?: string | null;
  teacherId?: string | null;
};

export type SessionPayload = SessionUser & {
  sub: string;
  sessionId: string;
  mfaVerified: boolean;
  impersonatedByPlatformAdminId?: string | null;
  supportReason?: string | null;
};

function getSecret() {
  const configuredSecret = process.env.AUTH_SECRET;

  if (configuredSecret && configuredSecret.length >= 32) {
    return new TextEncoder().encode(configuredSecret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET deve possuir pelo menos 32 caracteres.");
  }

  return new TextEncoder().encode(
    "minha-escola-dev-secret-change-before-production-2026",
  );
}

async function signSession(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION_SECONDS + "s")
    .sign(getSecret());
}

export async function createSession(
  user: SessionUser,
  options?: {
    request?: Request;
    mfaVerified?: boolean;
    impersonatedByPlatformAdminId?: string | null;
    supportReason?: string | null;
  },
) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_SECONDS * 1000,
  );
  const context = requestSecurityContext(options?.request);

  const stored = await prisma.userSession.create({
    data: {
      userId: user.id,
      expiresAt,
      lastSeenAt: now,
      userAgent: context.userAgent,
      ipHash: context.ipHash,
      mfaVerified: options?.mfaVerified !== false,
      impersonatedByPlatformAdminId:
        options?.impersonatedByPlatformAdminId || null,
      supportReason: options?.supportReason || null,
    },
  });

  const token = await signSession(user.id, stored.id);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return stored.id;
}

async function currentSessionId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const sessionId = await currentSessionId();

  if (sessionId) {
    await prisma.userSession
      .updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      })
      .catch(() => null);
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string | null,
) {
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const stored = await prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            school: {
              include: {
                subscription: true,
              },
            },
            enrollment: {
              include: { class: true },
            },
            guardian: true,
            teacher: true,
          },
        },
      },
    });

    if (!stored) return null;

    const user = stored.user;
    if (!user.active || !isAppRole(user.role)) return null;

    const requestHeaders = await headers();
    const requestHost =
      requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
    const hostSchoolId = await schoolIdForHost(requestHost);
    if (hostSchoolId && hostSchoolId !== user.schoolId) return null;

    if (
      ["SUSPENDED", "CANCELLED"].includes(user.school.lifecycleStatus) ||
      ["SUSPENDED", "CANCELLED"].includes(
        user.school.subscription?.status || "",
      )
    ) {
      return null;
    }

    if (
      user.school.lifecycleStatus === "ONBOARDING" &&
      user.role !== "ADMIN"
    ) {
      return null;
    }

    if (
      user.role === "STUDENT" &&
      (!user.enrollment ||
        user.enrollment.class.schoolId !== user.schoolId ||
        !["ACTIVE", "PENDING"].includes(user.enrollment.status))
    ) {
      return null;
    }

    if (
      user.role === "GUARDIAN" &&
      (!user.guardian ||
        user.guardian.schoolId !== user.schoolId ||
        user.guardian.status !== "ACTIVE")
    ) {
      return null;
    }

    if (
      user.role === "TEACHER" &&
      (!user.teacher ||
        user.teacher.schoolId !== user.schoolId ||
        user.teacher.status !== "ACTIVE")
    ) {
      return null;
    }

    if (
      Date.now() - stored.lastSeenAt.getTime() >
      5 * 60 * 1000
    ) {
      await prisma.userSession
        .update({
          where: { id: stored.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => null);
    }

    return {
      sub: user.id,
      sessionId: stored.id,
      id: user.id,
      schoolId: user.schoolId,
      schoolName: user.school.name,
      name: user.name,
      email: user.email,
      role: user.role,
      enrollmentId: user.enrollmentId,
      guardianId: user.guardianId,
      teacherId: user.teacherId,
      mfaVerified: stored.mfaVerified,
      impersonatedByPlatformAdminId:
        stored.impersonatedByPlatformAdminId,
      supportReason: stored.supportReason,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roles: AppRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/acesso-negado");
  return session;
}
