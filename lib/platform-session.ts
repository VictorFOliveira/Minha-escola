import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

const PLATFORM_COOKIE = "minha_escola_platform_session";
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

export async function createPlatformSession(input: {
  id: string;
  email: string;
  name: string;
}) {
  const token = await new SignJWT({
    email: input.email,
    name: input.name,
  })
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
}

export async function destroyPlatformSession() {
  const store = await cookies();
  store.delete(PLATFORM_COOKIE);
}

export async function getPlatformSession() {
  const store = await cookies();
  const token = store.get(PLATFORM_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;

    const admin = await prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
    });

    if (!admin?.active) return null;

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
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
