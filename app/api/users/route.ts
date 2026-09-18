import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_ROLES, isAppRole } from "@/lib/permissions";
import { getSession } from "@/lib/session";

async function requireAdminApi() {
  const session = await getSession();

  if (!session) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }

  if (session.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const users = await prisma.user.findMany({
    where: { schoolId: auth.session.schoolId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users, roles: APP_ROLES });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role;

  if (!name || !email || password.length < 8 || !isAppRole(role)) {
    return NextResponse.json(
      { error: "Preencha nome, e-mail, perfil e uma senha com pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return NextResponse.json(
      { error: "Já existe um usuário com este e-mail." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      schoolId: auth.session.schoolId,
      name,
      email,
      password: passwordHash,
      role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
