import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { isAppRole } from "@/lib/permissions";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { school: true },
  });

  if (!user || !user.active || !isAppRole(user.role)) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    );
  }

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    return NextResponse.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession({
    id: user.id,
    schoolId: user.schoolId,
    schoolName: user.school.name,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolName: user.school.name,
    },
  });
}
