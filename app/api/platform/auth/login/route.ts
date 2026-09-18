import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPlatformSession } from "@/lib/platform-session";
import { auditPlatformAction } from "@/lib/audit";
import {
  checkRateLimit,
  clearRateLimit,
  requestFingerprint,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  const fingerprint = requestFingerprint(request);
  const [ipThrottle, accountThrottle] = await Promise.all([
    checkRateLimit({
      action: "PLATFORM_LOGIN_IP",
      key: fingerprint,
      limit: 10,
      windowMs: 15 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }),
    checkRateLimit({
      action: "PLATFORM_LOGIN_ACCOUNT",
      key: email,
      limit: 6,
      windowMs: 15 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }),
  ]);

  if (!ipThrottle.allowed || !accountThrottle.allowed) {
    const retryAfter = Math.max(
      ipThrottle.retryAfterSeconds,
      accountThrottle.retryAfterSeconds,
    );
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  const admin = await prisma.platformAdmin.findUnique({
    where: { email },
  });

  if (!admin?.active) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    );
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    );
  }

  await Promise.all([
    prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    }),
    clearRateLimit("PLATFORM_LOGIN_ACCOUNT", email),
  ]);

  await createPlatformSession({
    id: admin.id,
    email: admin.email,
    name: admin.name,
  });

  await auditPlatformAction({
    platformAdminId: admin.id,
    action: "PLATFORM_LOGIN",
    entityType: "PlatformAdmin",
    entityId: admin.id,
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    homePath: "/superadmin",
  });
}
