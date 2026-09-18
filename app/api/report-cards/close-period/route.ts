import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";
import { calculatePeriodAverage } from "@/lib/grade-calculations";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const classSubjectId =
    typeof body?.classSubjectId === "string" ? body.classSubjectId : "";
  const periodId = typeof body?.periodId === "string" ? body.periodId : "";

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json(
      { error: "Disciplina da turma não encontrada ou sem acesso." },
      { status: 404 },
    );
  }

  const period = await prisma.academicPeriod.findFirst({
    where: {
      id: periodId,
      schoolId: session.schoolId,
      schoolYear: classSubject.class.schoolYear,
    },
  });

  if (!period) {
    return NextResponse.json({ error: "Período letivo inválido." }, { status: 400 });
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      classSubjectId,
      periodId,
      status: { in: ["PUBLISHED", "CLOSED"] },
    },
    include: {
      scores: true,
    },
  });

  if (!assessments.length) {
    return NextResponse.json(
      { error: "Não existem avaliações publicadas neste período." },
      { status: 409 },
    );
  }

  if (assessments.some((assessment) => assessment.status !== "CLOSED")) {
    return NextResponse.json(
      { error: "Feche todas as avaliações do período antes de fechar a média." },
      { status: 409 },
    );
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId: classSubject.classId,
      status: { not: "CANCELLED" },
      startedAt: { lte: period.endDate },
      OR: [
        { endedAt: null },
        { endedAt: { gte: period.startDate } },
      ],
    },
    include: { student: true },
  });

  const incomplete: string[] = [];
  const results = enrollments.map((enrollment) => {
    const inputs = assessments.map((assessment) => {
      const score = assessment.scores.find(
        (item) => item.enrollmentId === enrollment.id,
      );

      return {
        maxScore: Number(assessment.maxScore),
        weight: Number(assessment.weight),
        score:
          score?.score === null || score?.score === undefined
            ? null
            : Number(score.score),
        absent: Boolean(score?.absent),
        excused: Boolean(score?.excused),
      };
    });

    const calculated = calculatePeriodAverage(inputs);

    if (!calculated.complete || calculated.average === null) {
      incomplete.push(enrollment.student.name);
    }

    return {
      enrollment,
      average: calculated.average,
    };
  });

  if (incomplete.length) {
    return NextResponse.json(
      {
        error:
          "Há avaliações sem nota/falta registrada para alguns alunos. Complete os lançamentos antes do fechamento.",
        students: incomplete,
      },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    ...results.map(({ enrollment, average }) =>
      prisma.periodGrade.upsert({
        where: {
          enrollmentId_classSubjectId_periodId: {
            enrollmentId: enrollment.id,
            classSubjectId,
            periodId,
          },
        },
        update: {
          average,
          status: "CLOSED",
          closedAt: new Date(),
          closedByUserId: session.id,
        },
        create: {
          enrollmentId: enrollment.id,
          classSubjectId,
          periodId,
          average,
          status: "CLOSED",
          closedAt: new Date(),
          closedByUserId: session.id,
        },
      }),
    ),
    prisma.subjectFinalResult.updateMany({
      where: {
        classSubjectId,
        enrollmentId: {
          in: results.map(({ enrollment }) => enrollment.id),
        },
      },
      data: {
        annualAverage: null,
        recoveryScore: null,
        finalAverage: null,
        status: "IN_PROGRESS",
        closedAt: null,
        closedByUserId: null,
      },
    }),
    prisma.enrollmentAcademicResult.updateMany({
      where: {
        enrollmentId: { in: results.map(({ enrollment }) => enrollment.id) },
      },
      data: {
        status: "IN_PROGRESS",
        closedAt: null,
        closedByUserId: null,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    closed: results.length,
    period: {
      id: period.id,
      name: period.name,
    },
  });
}
