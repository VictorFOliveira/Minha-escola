import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";

type Context = { params: Promise<{ id: string }> };

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function findWithAccess(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      classSubject: { include: { class: true, subject: true, teacher: true } },
      period: true,
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  if (!lesson) return null;
  const access = await canAccessClassSubject(session, lesson.classSubjectId);
  return access ? lesson : null;
}

export async function GET(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const lesson = await findWithAccess(id, session);

  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada ou sem acesso." }, { status: 404 });
  }

  return NextResponse.json({ lesson });
}

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await findWithAccess(id, session);

  if (!current) {
    return NextResponse.json({ error: "Aula não encontrada ou sem acesso." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.lessonDate !== undefined) {
    const date = new Date(String(body.lessonDate) + "T12:00:00.000Z");
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }
    data.lessonDate = date;
  }

  if (body?.startTime !== undefined) {
    const value = body.startTime ? String(body.startTime).trim() : "";
    if (value && !validTime(value)) {
      return NextResponse.json({ error: "Horário inicial inválido." }, { status: 400 });
    }
    data.startTime = value || null;
  }

  if (body?.endTime !== undefined) {
    const value = body.endTime ? String(body.endTime).trim() : "";
    if (value && !validTime(value)) {
      return NextResponse.json({ error: "Horário final inválido." }, { status: 400 });
    }
    data.endTime = value || null;
  }

  const start = data.startTime !== undefined ? data.startTime : current.startTime;
  const end = data.endTime !== undefined ? data.endTime : current.endTime;

  if (typeof start === "string" && typeof end === "string" && end <= start) {
    return NextResponse.json({ error: "O horário final deve ser posterior ao inicial." }, { status: 400 });
  }

  for (const field of ["plannedContent", "taughtContent", "homework", "notes"]) {
    if (body?.[field] !== undefined) {
      data[field] = body[field] ? String(body[field]).trim() : null;
    }
  }

  if (["PLANNED", "OPEN", "COMPLETED", "CANCELLED"].includes(body?.status)) {
    data.status = body.status;
  }

  if (body?.periodId !== undefined) {
    if (!body.periodId) {
      data.periodId = null;
    } else {
      const period = await prisma.academicPeriod.findFirst({
        where: {
          id: String(body.periodId),
          schoolId: session.schoolId,
          schoolYear: current.classSubject.class.schoolYear,
        },
      });

      if (!period) {
        return NextResponse.json({ error: "Período letivo inválido." }, { status: 400 });
      }

      data.periodId = period.id;
    }
  }

  const lesson = await prisma.lesson.update({
    where: { id },
    data,
    include: {
      period: true,
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { attendance: true } },
    },
  });

  return NextResponse.json({ lesson });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const lesson = await findWithAccess(id, session);

  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada ou sem acesso." }, { status: 404 });
  }

  if (lesson.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Aula concluída não pode ser excluída. Cancele ou reabra o registro." },
      { status: 409 },
    );
  }

  await prisma.lesson.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
