import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.classSubject.findFirst({
    where: {
      id,
      class: { schoolId: session.schoolId },
    },
  });

  if (!current) return NextResponse.json({ error: "Disciplina da turma não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  let teacherId: string | null | undefined = undefined;

  if (body?.teacherId !== undefined) {
    if (!body.teacherId) {
      teacherId = null;
    } else {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: String(body.teacherId),
          schoolId: session.schoolId,
          status: "ACTIVE",
        },
      });

      if (!teacher) return NextResponse.json({ error: "Professor inválido." }, { status: 400 });
      teacherId = teacher.id;
    }
  }

  let weeklyClasses: number | null | undefined = undefined;
  if (body?.weeklyClasses !== undefined) {
    if (body.weeklyClasses === "" || body.weeklyClasses === null) {
      weeklyClasses = null;
    } else {
      const value = Number(body.weeklyClasses);
      if (!Number.isInteger(value) || value <= 0) {
        return NextResponse.json({ error: "Quantidade de aulas semanais inválida." }, { status: 400 });
      }
      weeklyClasses = value;
    }
  }

  const item = await prisma.classSubject.update({
    where: { id },
    data: {
      ...(teacherId !== undefined ? { teacherId } : {}),
      ...(weeklyClasses !== undefined ? { weeklyClasses } : {}),
    },
    include: {
      subject: true,
      teacher: true,
      scheduleSlots: true,
    },
  });

  return NextResponse.json({ classSubject: item });
}
