import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getAcademicPolicy } from "@/lib/report-card";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;

  const classGroup = await prisma.classGroup.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      ...(session.role === "TEACHER" && session.teacherId
        ? {
            classSubjects: {
              some: { teacherId: session.teacherId },
            },
          }
        : {}),
    },
    include: {
      classSubjects: {
        where:
          session.role === "TEACHER" && session.teacherId
            ? { teacherId: session.teacherId }
            : undefined,
        orderBy: { subject: { name: "asc" } },
        include: {
          subject: true,
          teacher: true,
        },
      },
      enrollments: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { student: { name: "asc" } },
        include: {
          student: true,
          periodGrades: {
            include: { period: true },
          },
          subjectResults: true,
          academicResult: true,
        },
      },
    },
  });

  if (!classGroup) {
    return NextResponse.json(
      { error: "Turma não encontrada ou sem acesso." },
      { status: 404 },
    );
  }

  const [periods, policy] = await Promise.all([
    prisma.academicPeriod.findMany({
      where: {
        schoolId: session.schoolId,
        schoolYear: classGroup.schoolYear,
      },
      orderBy: { order: "asc" },
    }),
    getAcademicPolicy(session.schoolId, classGroup.schoolYear),
  ]);

  return NextResponse.json({
    class: classGroup,
    periods,
    policy,
    canFinalizeEnrollment: ["ADMIN", "COORDINATOR"].includes(session.role),
    canEditPolicy: ["ADMIN", "COORDINATOR"].includes(session.role),
  });
}
