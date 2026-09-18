import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";
import { buildSubjectResult } from "@/lib/report-card";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const classSubjectId =
    typeof body?.classSubjectId === "string" ? body.classSubjectId : "";

  const classSubject = await canAccessClassSubject(session, classSubjectId);
  if (!classSubject) {
    return NextResponse.json(
      { error: "Disciplina da turma não encontrada ou sem acesso." },
      { status: 404 },
    );
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId: classSubject.classId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
  });

  const calculated = await Promise.all(
    enrollments.map((enrollment) =>
      buildSubjectResult({
        schoolId: session.schoolId,
        enrollmentId: enrollment.id,
        classSubjectId,
      }),
    ),
  );

  const incomplete = calculated.filter(
    (item) => !item || !item.allPeriodsClosed,
  );

  if (incomplete.length) {
    return NextResponse.json(
      {
        error:
          "Ainda existem períodos sem fechamento para esta disciplina. Feche todas as médias por período primeiro.",
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(
    calculated.map((item) => {
      if (!item) throw new Error("Resultado acadêmico inválido.");

      return prisma.subjectFinalResult.upsert({
        where: {
          enrollmentId_classSubjectId: {
            enrollmentId: item.enrollment.id,
            classSubjectId,
          },
        },
        update: {
          annualAverage: item.annualAverage,
          finalAverage: item.finalAverage,
          attendancePercent: item.attendancePercent,
          status: item.status,
          closedAt: item.status === "RECOVERY" ? null : new Date(),
          closedByUserId:
            item.status === "RECOVERY" ? null : session.id,
        },
        create: {
          enrollmentId: item.enrollment.id,
          classSubjectId,
          annualAverage: item.annualAverage,
          finalAverage: item.finalAverage,
          attendancePercent: item.attendancePercent,
          status: item.status,
          closedAt: item.status === "RECOVERY" ? null : new Date(),
          closedByUserId:
            item.status === "RECOVERY" ? null : session.id,
        },
      });
    }),
  );

  return NextResponse.json({
    ok: true,
    processed: calculated.length,
    recovery: calculated.filter((item) => item?.status === "RECOVERY").length,
  });
}
