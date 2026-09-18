import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";
import { buildSubjectResult, recomputeEnrollmentStatus } from "@/lib/report-card";

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const enrollmentId =
    typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
  const classSubjectId =
    typeof body?.classSubjectId === "string" ? body.classSubjectId : "";
  const recoveryScore =
    body?.recoveryScore === "" || body?.recoveryScore === null
      ? null
      : Number(body?.recoveryScore);

  if (
    recoveryScore !== null &&
    (Number.isNaN(recoveryScore) || recoveryScore < 0 || recoveryScore > 10)
  ) {
    return NextResponse.json(
      { error: "A nota de recuperação deve estar entre 0 e 10." },
      { status: 400 },
    );
  }

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json({ error: "Disciplina sem acesso." }, { status: 403 });
  }

  const current = await prisma.subjectFinalResult.findUnique({
    where: {
      enrollmentId_classSubjectId: {
        enrollmentId,
        classSubjectId,
      },
    },
  });

  if (!current) {
    return NextResponse.json(
      { error: "Feche primeiro o resultado anual da disciplina." },
      { status: 409 },
    );
  }

  let manualFinalAverage: number | null | undefined = undefined;

  if (body?.manualFinalAverage !== undefined) {
    manualFinalAverage =
      body.manualFinalAverage === "" || body.manualFinalAverage === null
        ? null
        : Number(body.manualFinalAverage);

    if (
      manualFinalAverage !== null &&
      (Number.isNaN(manualFinalAverage) ||
        manualFinalAverage < 0 ||
        manualFinalAverage > 10)
    ) {
      return NextResponse.json(
        { error: "A média final manual deve estar entre 0 e 10." },
        { status: 400 },
      );
    }
  }

  const calculated = await buildSubjectResult({
    schoolId: session.schoolId,
    enrollmentId,
    classSubjectId,
    recoveryScore,
    manualFinalAverage,
  });

  if (!calculated || !calculated.allPeriodsClosed) {
    return NextResponse.json(
      { error: "Não foi possível recalcular o resultado da disciplina." },
      { status: 409 },
    );
  }

  if (
    calculated.policy.recoveryMode === "MANUAL" &&
    recoveryScore !== null &&
    manualFinalAverage === undefined
  ) {
    return NextResponse.json(
      { error: "Esta escola usa média final manual após recuperação." },
      { status: 400 },
    );
  }

  const result = await prisma.subjectFinalResult.update({
    where: {
      enrollmentId_classSubjectId: {
        enrollmentId,
        classSubjectId,
      },
    },
    data: {
      annualAverage: calculated.annualAverage,
      recoveryScore,
      finalAverage: calculated.finalAverage,
      attendancePercent: calculated.attendancePercent,
      status: calculated.status,
      closedAt:
        calculated.status === "RECOVERY" ||
        calculated.status === "IN_PROGRESS"
          ? null
          : new Date(),
      closedByUserId:
        calculated.status === "RECOVERY" ||
        calculated.status === "IN_PROGRESS"
          ? null
          : session.id,
    },
  });

  const enrollmentStatus = await recomputeEnrollmentStatus(enrollmentId);

  return NextResponse.json({
    result,
    enrollmentStatus: enrollmentStatus?.status || "IN_PROGRESS",
  });
}
