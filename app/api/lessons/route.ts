import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";

const roles = ["ADMIN", "COORDINATOR", "TEACHER"];

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const classSubjectId = url.searchParams.get("classSubjectId") || "";

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json({ error: "Disciplina da turma não encontrada ou sem acesso." }, { status: 404 });
  }

  const lessons = await prisma.lesson.findMany({
    where: { classSubjectId },
    orderBy: [{ lessonDate: "desc" }, { startTime: "desc" }],
    include: {
      period: true,
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { attendance: true } },
    },
  });

  return NextResponse.json({ lessons });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const classSubjectId =
    typeof body?.classSubjectId === "string" ? body.classSubjectId : "";

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json({ error: "Disciplina da turma inválida ou sem acesso." }, { status: 404 });
  }

  const lessonDate = body?.lessonDate ? new Date(body.lessonDate) : null;
  const startTime = typeof body?.startTime === "string" ? body.startTime.trim() : "";
  const endTime = typeof body?.endTime === "string" ? body.endTime.trim() : "";

  if (!lessonDate || Number.isNaN(lessonDate.getTime())) {
    return NextResponse.json({ error: "Data da aula inválida." }, { status: 400 });
  }

  if ((startTime && !validTime(startTime)) || (endTime && !validTime(endTime))) {
    return NextResponse.json({ error: "Horário inválido." }, { status: 400 });
  }

  if (startTime && endTime && endTime <= startTime) {
    return NextResponse.json({ error: "O horário final deve ser posterior ao inicial." }, { status: 400 });
  }

  let periodId: string | null = null;
  if (body?.periodId) {
    const period = await prisma.academicPeriod.findFirst({
      where: {
        id: String(body.periodId),
        schoolId: session.schoolId,
        schoolYear: classSubject.class.schoolYear,
      },
    });

    if (!period) {
      return NextResponse.json({ error: "Período letivo inválido." }, { status: 400 });
    }

    periodId = period.id;
  }

  const lesson = await prisma.lesson.create({
    data: {
      classSubjectId,
      periodId,
      createdByUserId: session.id,
      lessonDate,
      startTime: startTime || null,
      endTime: endTime || null,
      plannedContent: body?.plannedContent?.trim() || null,
      taughtContent: body?.taughtContent?.trim() || null,
      homework: body?.homework?.trim() || null,
      notes: body?.notes?.trim() || null,
      status: ["PLANNED", "OPEN", "COMPLETED", "CANCELLED"].includes(body?.status)
        ? body.status
        : "OPEN",
    },
    include: {
      period: true,
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ lesson }, { status: 201 });
}
