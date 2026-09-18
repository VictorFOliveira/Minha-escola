import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import type { AppRole } from "@/lib/permissions";

export const SESSION_COOKIE = "minha_escola_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type SessionUser = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  email: string;
  role: AppRole;
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
    schoolName: user.schoolName,
    name: user.name,
    email: user.email,
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

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.id !== "string" ||
      typeof payload.schoolId !== "string" ||
      typeof payload.schoolName !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      id: payload.id,
      schoolId: payload.schoolId,
      schoolName: payload.schoolName,
      name: payload.name,
      email: payload.email,
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireRole(roles: AppRole[]) {
  const session = await requireSession();

  if (!roles.includes(session.role)) {
    redirect("/dashboard?forbidden=1");
  }

  return session;
}
