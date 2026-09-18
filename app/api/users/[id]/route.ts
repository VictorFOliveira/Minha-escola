import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAppRole } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const target = await prisma.user.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: {
    active?: boolean;
    role?: typeof target.role;
    enrollmentId?: string | null;
    guardianId?: string | null;
    teacherId?: string | null;
  } = {};

  if (typeof body?.active === "boolean") {
    if (target.id === session.id && body.active === false) {
      return NextResponse.json({ error: "Você não pode desativar seu próprio usuário." }, { status: 400 });
    }
    data.active = body.active;
  }

  if (body?.role !== undefined) {
    if (!isAppRole(body.role)) {
      return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    }

    if (target.id === session.id && body.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Você não pode remover seu próprio acesso de administrador." },
        { status: 400 },
      );
    }

    if (body.role === "STUDENT" && !target.enrollmentId && !body?.enrollmentId) {
      return NextResponse.json(
        { error: "Para transformar a conta em aluno, vincule primeiro uma matrícula." },
        { status: 400 },
      );
    }

    if (body.role === "GUARDIAN" && !target.guardianId && !body?.guardianId) {
      return NextResponse.json(
        { error: "Para transformar a conta em responsável, vincule primeiro um responsável." },
        { status: 400 },
      );
    }

    if (body.role === "TEACHER" && !target.teacherId && !body?.teacherId) {
      return NextResponse.json(
        { error: "Para transformar a conta em professor, vincule primeiro um professor." },
        { status: 400 },
      );
    }

    data.role = body.role;

    if (!["STUDENT", "GUARDIAN", "TEACHER"].includes(body.role)) {
      data.enrollmentId = null;
      data.guardianId = null;
      data.teacherId = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração informada." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: target.id },
    data,
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

  return NextResponse.json({ user });
}
