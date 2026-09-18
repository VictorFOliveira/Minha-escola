import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_ROLES, isAppRole } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { assertUserLimit } from "@/lib/tenant-limits";

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
      enrollment: {
        select: {
          id: true,
          status: true,
          student: { select: { id: true, name: true, registration: true } },
          class: { select: { id: true, name: true, schoolYear: true } },
        },
      },
      guardian: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ users, roles: APP_ROLES });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  try {
    await assertUserLimit(auth.session.schoolId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Limite do plano atingido." },
      { status: 409 },
    );
  }

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
    return NextResponse.json({ error: "Já existe um usuário com este e-mail." }, { status: 409 });
  }

  let enrollmentId: string | null = null;
  let guardianId: string | null = null;
  let teacherId: string | null = null;

  if (role === "STUDENT") {
    enrollmentId = typeof body?.enrollmentId === "string" ? body.enrollmentId : "";

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        status: { in: ["ACTIVE", "PENDING"] },
        class: { schoolId: auth.session.schoolId },
      },
      include: { portalUser: true },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Selecione uma matrícula válida para a conta do aluno." }, { status: 400 });
    }

    if (enrollment.portalUser) {
      return NextResponse.json({ error: "Esta matrícula já possui uma conta de aluno vinculada." }, { status: 409 });
    }
  }

  if (role === "GUARDIAN") {
    guardianId = typeof body?.guardianId === "string" ? body.guardianId : "";

    const guardian = await prisma.guardian.findFirst({
      where: { id: guardianId, schoolId: auth.session.schoolId, status: "ACTIVE" },
      include: { portalUser: true },
    });

    if (!guardian) {
      return NextResponse.json({ error: "Selecione um responsável válido." }, { status: 400 });
    }

    if (guardian.portalUser) {
      return NextResponse.json({ error: "Este responsável já possui uma conta vinculada." }, { status: 409 });
    }
  }

  if (role === "TEACHER") {
    teacherId = typeof body?.teacherId === "string" ? body.teacherId : "";

    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, schoolId: auth.session.schoolId, status: "ACTIVE" },
      include: { portalUser: true },
    });

    if (!teacher) {
      return NextResponse.json({ error: "Selecione um professor válido." }, { status: 400 });
    }

    if (teacher.portalUser) {
      return NextResponse.json({ error: "Este professor já possui uma conta vinculada." }, { status: 409 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      schoolId: auth.session.schoolId,
      name,
      email,
      password: passwordHash,
      role,
      enrollmentId,
      guardianId,
      teacherId,
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
