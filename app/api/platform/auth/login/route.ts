import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPlatformSession } from "@/lib/platform-session";
import { auditPlatformAction } from "@/lib/audit";

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

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

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
