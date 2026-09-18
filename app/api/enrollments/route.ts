import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const readRoles = ["ADMIN", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "SECRETARY"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const url = new URL(request.url);
  const schoolYearParam = url.searchParams.get("schoolYear");
  const schoolYear = schoolYearParam ? Number(schoolYearParam) : null;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      class: {
        schoolId: session.schoolId,
        ...(Number.isInteger(schoolYear) ? { schoolYear: schoolYear as number } : {}),
      },
    },
    orderBy: [{ class: { schoolYear: "desc" } }, { startedAt: "desc" }],
    include: {
      student: true,
      class: { include: { teacher: true } },
      previousEnrollment: {
        include: { class: true },
      },
      nextEnrollment: {
        include: { class: true },
      },
    },
  });

  return NextResponse.json({ enrollments });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const classId = typeof body?.classId === "string" ? body.classId : "";

  const [student, classGroup] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId: session.schoolId, status: "ACTIVE" },
    }),
    prisma.classGroup.findFirst({
      where: { id: classId, schoolId: session.schoolId },
      include: { _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "PENDING"] } } } } } },
    }),
  ]);

  if (!student || !classGroup) {
    return NextResponse.json({ error: "Aluno ou turma inválido." }, { status: 404 });
  }

  if (classGroup.capacity && classGroup._count.enrollments >= classGroup.capacity) {
    return NextResponse.json({ error: "A turma atingiu a capacidade cadastrada." }, { status: 409 });
  }

  const duplicate = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "O aluno já possui histórico nesta turma." }, { status: 409 });
  }

  const sameYear = await prisma.enrollment.findFirst({
    where: {
      studentId,
      status: { in: ["ACTIVE", "PENDING"] },
      class: {
        schoolId: session.schoolId,
        schoolYear: classGroup.schoolYear,
      },
    },
    include: { class: true },
  });

  if (sameYear) {
    return NextResponse.json(
      { error: "O aluno já possui matrícula ativa ou pendente em " + sameYear.class.name + " no ano " + classGroup.schoolYear + "." },
      { status: 409 },
    );
  }

  const status = body?.status === "PENDING" ? "PENDING" : "ACTIVE";
  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classId,
      type: "NEW",
      status,
      notes: body?.notes?.trim() || null,
      startedAt: body?.startedAt ? new Date(body.startedAt) : new Date(),
    },
    include: { student: true, class: true },
  });

  return NextResponse.json({ enrollment }, { status: 201 });
}
