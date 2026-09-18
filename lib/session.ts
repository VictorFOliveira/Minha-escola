import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { isAppRole, type AppRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

type SessionPayload = SessionUser & {
  sub: string;
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

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    schoolId: user.schoolId,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION_SECONDS + "s")
    .sign(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (typeof payload.sub !== "string") return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
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
    });

    if (!user || !user.active || !isAppRole(user.role)) return null;

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
      (
        !user.enrollment ||
        user.enrollment.class.schoolId !== user.schoolId ||
        !["ACTIVE", "PENDING"].includes(user.enrollment.status)
      )
    ) {
      return null;
    }

    if (
      user.role === "GUARDIAN" &&
      (!user.guardian || user.guardian.schoolId !== user.schoolId || user.guardian.status !== "ACTIVE")
    ) {
      return null;
    }

    if (
      user.role === "TEACHER" &&
      (!user.teacher || user.teacher.schoolId !== user.schoolId || user.teacher.status !== "ACTIVE")
    ) {
      return null;
    }

    return {
      sub: user.id,
      id: user.id,
      schoolId: user.schoolId,
      schoolName: user.school.name,
      name: user.name,
      email: user.email,
      role: user.role,
      enrollmentId: user.enrollmentId,
      guardianId: user.guardianId,
      teacherId: user.teacherId,
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
