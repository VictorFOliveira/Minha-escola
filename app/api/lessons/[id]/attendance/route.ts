import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";

type Context = { params: Promise<{ id: string }> };

async function getLesson(id: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      classSubject: {
        include: {
          class: true,
          subject: true,
          teacher: true,
        },
      },
      period: true,
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
  const lesson = await getLesson(id, session);

  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada ou sem acesso." }, { status: 404 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId: lesson.classSubject.classId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { student: { name: "asc" } },
    include: {
      student: true,
      lessonAttendances: {
        where: { lessonId: lesson.id },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    lesson,
    students: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: enrollment.student,
      attendance: enrollment.lessonAttendances[0] || null,
    })),
  });
}

export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const lesson = await getLesson(id, session);

  if (!lesson) {
    return NextResponse.json({ error: "Aula não encontrada ou sem acesso." }, { status: 404 });
  }

  if (lesson.status === "CANCELLED") {
    return NextResponse.json({ error: "Não é possível lançar presença em aula cancelada." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);

  if (!Array.isArray(body?.attendance)) {
    return NextResponse.json({ error: "Informe a lista de presença." }, { status: 400 });
  }

  const allowed = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
  const enrollmentIds = body.attendance
    .map((item: any) => (typeof item?.enrollmentId === "string" ? item.enrollmentId : ""))
    .filter(Boolean);

  if (new Set(enrollmentIds).size !== enrollmentIds.length) {
    return NextResponse.json({ error: "Há matrícula duplicada na chamada." }, { status: 400 });
  }

  const validEnrollments = await prisma.enrollment.findMany({
    where: {
      id: { in: enrollmentIds },
      classId: lesson.classSubject.classId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { id: true },
  });

  if (validEnrollments.length !== enrollmentIds.length) {
    return NextResponse.json({ error: "Há aluno inválido para esta turma." }, { status: 400 });
  }

  for (const item of body.attendance) {
    if (!allowed.includes(item?.status)) {
      return NextResponse.json({ error: "Há um status de presença inválido." }, { status: 400 });
    }
  }

  await prisma.$transaction(
    body.attendance.map((item: any) =>
      prisma.lessonAttendance.upsert({
        where: {
          lessonId_enrollmentId: {
            lessonId: lesson.id,
            enrollmentId: item.enrollmentId,
          },
        },
        update: {
          status: item.status,
          note: item.note ? String(item.note).trim() : null,
        },
        create: {
          lessonId: lesson.id,
          enrollmentId: item.enrollmentId,
          status: item.status,
          note: item.note ? String(item.note).trim() : null,
        },
      }),
    ),
  );

  if (body?.completeLesson === true) {
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({ ok: true });
}
