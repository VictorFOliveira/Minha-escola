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
      return NextResponse.json(
        { error: "Você não pode desativar seu próprio usuário." },
        { status: 400 },
      );
    }
    data.active = body.active;
  }

  if (body?.enrollmentId !== undefined) {
    if (!body.enrollmentId) {
      data.enrollmentId = null;
    } else {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          id: String(body.enrollmentId),
          status: { in: ["ACTIVE", "PENDING"] },
          class: { schoolId: session.schoolId },
        },
        include: { portalUser: true },
      });

      if (!enrollment) {
        return NextResponse.json({ error: "Matrícula inválida." }, { status: 400 });
      }

      if (enrollment.portalUser && enrollment.portalUser.id !== target.id) {
        return NextResponse.json(
          { error: "Esta matrícula já está vinculada a outro usuário." },
          { status: 409 },
        );
      }

      data.enrollmentId = enrollment.id;
    }
  }

  if (body?.guardianId !== undefined) {
    if (!body.guardianId) {
      data.guardianId = null;
    } else {
      const guardian = await prisma.guardian.findFirst({
        where: {
          id: String(body.guardianId),
          schoolId: session.schoolId,
          status: "ACTIVE",
        },
        include: { portalUser: true },
      });

      if (!guardian) {
        return NextResponse.json({ error: "Responsável inválido." }, { status: 400 });
      }

      if (guardian.portalUser && guardian.portalUser.id !== target.id) {
        return NextResponse.json(
          { error: "Este responsável já está vinculado a outro usuário." },
          { status: 409 },
        );
      }

      data.guardianId = guardian.id;
    }
  }

  if (body?.teacherId !== undefined) {
    if (!body.teacherId) {
      data.teacherId = null;
    } else {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: String(body.teacherId),
          schoolId: session.schoolId,
          status: "ACTIVE",
        },
        include: { portalUser: true },
      });

      if (!teacher) {
        return NextResponse.json({ error: "Professor inválido." }, { status: 400 });
      }

      if (teacher.portalUser && teacher.portalUser.id !== target.id) {
        return NextResponse.json(
          { error: "Este professor já está vinculado a outro usuário." },
          { status: 409 },
        );
      }

      data.teacherId = teacher.id;
    }
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

    const nextEnrollmentId =
      data.enrollmentId !== undefined ? data.enrollmentId : target.enrollmentId;
    const nextGuardianId =
      data.guardianId !== undefined ? data.guardianId : target.guardianId;
    const nextTeacherId =
      data.teacherId !== undefined ? data.teacherId : target.teacherId;

    if (body.role === "STUDENT" && !nextEnrollmentId) {
      return NextResponse.json(
        { error: "Para usar o perfil Aluno, vincule uma matrícula." },
        { status: 400 },
      );
    }

    if (body.role === "GUARDIAN" && !nextGuardianId) {
      return NextResponse.json(
        { error: "Para usar o perfil Responsável, vincule um responsável." },
        { status: 400 },
      );
    }

    if (body.role === "TEACHER" && !nextTeacherId) {
      return NextResponse.json(
        { error: "Para usar o perfil Professor, vincule um professor." },
        { status: 400 },
      );
    }

    data.role = body.role;

    if (body.role !== "STUDENT") data.enrollmentId = null;
    if (body.role !== "GUARDIAN") data.guardianId = null;
    if (body.role !== "TEACHER") data.teacherId = null;
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
      enrollment: {
        select: {
          id: true,
          student: { select: { name: true, registration: true } },
          class: { select: { name: true, schoolYear: true } },
        },
      },
      guardian: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ user });
}
