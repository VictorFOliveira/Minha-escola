import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";

const readRoles = ["ADMIN", "COORDINATOR", "TEACHER"];
const writeRoles = ["ADMIN", "COORDINATOR", "TEACHER"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const classSubjectId = url.searchParams.get("classSubjectId");

  if (!classSubjectId) {
    return NextResponse.json({ error: "classSubjectId é obrigatório." }, { status: 400 });
  }

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json({ error: "Disciplina da turma não encontrada ou sem acesso." }, { status: 404 });
  }

  const assessments = await prisma.assessment.findMany({
    where: { classSubjectId },
    orderBy: [{ assessmentDate: "asc" }, { title: "asc" }],
    include: {
      period: true,
      _count: { select: { scores: true } },
    },
  });

  return NextResponse.json({ assessments });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const classSubjectId = typeof body?.classSubjectId === "string" ? body.classSubjectId : "";
  const periodId = typeof body?.periodId === "string" ? body.periodId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const type = ["EXAM", "QUIZ", "ASSIGNMENT", "PROJECT", "PARTICIPATION", "OTHER"].includes(body?.type)
    ? body.type
    : "EXAM";
  const status = ["DRAFT", "PUBLISHED", "CLOSED"].includes(body?.status)
    ? body.status
    : "DRAFT";
  const assessmentDate = body?.assessmentDate ? new Date(body.assessmentDate) : null;
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
  const maxScore = Number(body?.maxScore ?? 10);
  const weight = Number(body?.weight ?? 1);

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json({ error: "Disciplina da turma inválida ou sem acesso." }, { status: 404 });
  }

  const period = await prisma.academicPeriod.findFirst({
    where: {
      id: periodId,
      schoolId: session.schoolId,
      schoolYear: classSubject.class.schoolYear,
    },
  });

  if (
    !period ||
    !title ||
    !assessmentDate ||
    Number.isNaN(assessmentDate.getTime()) ||
    !(maxScore > 0) ||
    !(weight > 0)
  ) {
    return NextResponse.json(
      { error: "Preencha período, título, data, nota máxima e peso corretamente." },
      { status: 400 },
    );
  }

  const assessment = await prisma.assessment.create({
    data: {
      classSubjectId,
      periodId,
      title,
      description: description || null,
      type,
      status,
      assessmentDate,
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
      maxScore,
      weight,
    },
    include: { period: true },
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
