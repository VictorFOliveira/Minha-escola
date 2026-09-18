import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";

type Context = { params: Promise<{ id: string }> };

async function getAssessmentWithAccess(session: Awaited<ReturnType<typeof getSession>>, id: string) {
  if (!session) return null;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      classSubject: {
        include: { class: true, subject: true },
      },
      period: true,
    },
  });

  if (!assessment) return null;

  const access = await canAccessClassSubject(session, assessment.classSubjectId);
  return access ? assessment : null;
}

export async function GET(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const assessment = await getAssessmentWithAccess(session, id);

  if (!assessment) return NextResponse.json({ error: "Avaliação não encontrada ou sem acesso." }, { status: 404 });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId: assessment.classSubject.classId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    orderBy: { student: { name: "asc" } },
    include: {
      student: true,
      assessmentScores: {
        where: { assessmentId: assessment.id },
      },
    },
  });

  return NextResponse.json({
    assessment,
    students: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: enrollment.student,
      score: enrollment.assessmentScores[0] || null,
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
  const assessment = await getAssessmentWithAccess(session, id);

  if (!assessment) return NextResponse.json({ error: "Avaliação não encontrada ou sem acesso." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.scores)) {
    return NextResponse.json({ error: "Informe as notas." }, { status: 400 });
  }

  const enrollmentIds = body.scores
    .map((item: any) => (typeof item?.enrollmentId === "string" ? item.enrollmentId : ""))
    .filter(Boolean);

  const validEnrollments = await prisma.enrollment.findMany({
    where: {
      id: { in: enrollmentIds },
      classId: assessment.classSubject.classId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { id: true },
  });

  if (validEnrollments.length !== new Set(enrollmentIds).size) {
    return NextResponse.json({ error: "Há matrícula inválida na lista de notas." }, { status: 400 });
  }

  const maxScore = Number(assessment.maxScore);

  for (const item of body.scores) {
    if (!item?.enrollmentId) continue;

    const absent = Boolean(item.absent);
    const excused = Boolean(item.excused);
    const rawScore = item.score === "" || item.score == null ? null : Number(item.score);

    if (rawScore !== null && (Number.isNaN(rawScore) || rawScore < 0 || rawScore > maxScore)) {
      return NextResponse.json(
        { error: "Uma nota está fora do intervalo permitido de 0 a " + maxScore + "." },
        { status: 400 },
      );
    }

    if (absent && rawScore !== null) {
      return NextResponse.json(
        { error: "Aluno marcado como ausente não pode ter nota numérica." },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(
    body.scores
      .filter((item: any) => item?.enrollmentId)
      .map((item: any) =>
        prisma.assessmentScore.upsert({
          where: {
            assessmentId_enrollmentId: {
              assessmentId: assessment.id,
              enrollmentId: item.enrollmentId,
            },
          },
          update: {
            score: item.score === "" || item.score == null ? null : Number(item.score),
            absent: Boolean(item.absent),
            excused: Boolean(item.excused),
            feedback: item.feedback ? String(item.feedback).trim() : null,
          },
          create: {
            assessmentId: assessment.id,
            enrollmentId: item.enrollmentId,
            score: item.score === "" || item.score == null ? null : Number(item.score),
            absent: Boolean(item.absent),
            excused: Boolean(item.excused),
            feedback: item.feedback ? String(item.feedback).trim() : null,
          },
        }),
      ),
  );

  return NextResponse.json({ ok: true });
}
