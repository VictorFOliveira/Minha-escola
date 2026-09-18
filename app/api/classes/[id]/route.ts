import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const writeRoles = ["ADMIN", "SECRETARY"];

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.classGroup.findFirst({
    where: { id, schoolId: session.schoolId },
  });
  if (!current) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  for (const field of ["name", "gradeLevel", "shift", "room"]) {
    if (body?.[field] !== undefined) data[field] = body[field] ? String(body[field]).trim() : null;
  }

  if (body?.schoolYear !== undefined) {
    const year = Number(body.schoolYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Ano letivo inválido." }, { status: 400 });
    }
    data.schoolYear = year;
  }

  if (body?.capacity !== undefined) {
    if (body.capacity === "" || body.capacity === null) {
      data.capacity = null;
    } else {
      const capacity = Number(body.capacity);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        return NextResponse.json({ error: "Capacidade inválida." }, { status: 400 });
      }
      data.capacity = capacity;
    }
  }

  if (body?.teacherId !== undefined) {
    if (!body.teacherId) {
      data.teacherId = null;
    } else {
      const teacher = await prisma.teacher.findFirst({
        where: { id: String(body.teacherId), schoolId: session.schoolId, status: "ACTIVE" },
      });
      if (!teacher) return NextResponse.json({ error: "Professor inválido." }, { status: 400 });
      data.teacherId = teacher.id;
    }
  }

  const classGroup = await prisma.classGroup.update({
    where: { id },
    data,
    include: { teacher: true, _count: { select: { enrollments: true } } },
  });

  return NextResponse.json({ class: classGroup });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.classGroup.findFirst({
    where: { id, schoolId: session.schoolId },
    include: { _count: { select: { enrollments: true } } },
  });

  if (!current) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
  if (current._count.enrollments > 0) {
    return NextResponse.json(
      { error: "Não é possível excluir uma turma que possui histórico de matrículas." },
      { status: 409 },
    );
  }

  await prisma.classGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
