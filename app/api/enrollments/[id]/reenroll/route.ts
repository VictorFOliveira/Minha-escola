import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const targetClassId = typeof body?.targetClassId === "string" ? body.targetClassId : "";

  const [source, targetClass] = await Promise.all([
    prisma.enrollment.findFirst({
      where: { id, class: { schoolId: session.schoolId } },
      include: { student: true, class: true, nextEnrollment: true },
    }),
    prisma.classGroup.findFirst({
      where: { id: targetClassId, schoolId: session.schoolId },
      include: { _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "PENDING"] } } } } } },
    }),
  ]);

  if (!source || !targetClass) {
    return NextResponse.json({ error: "Matrícula de origem ou turma de destino não encontrada." }, { status: 404 });
  }

  if (source.nextEnrollment) {
    return NextResponse.json({ error: "Esta matrícula já possui uma rematrícula vinculada." }, { status: 409 });
  }

  if (targetClass.schoolYear <= source.class.schoolYear) {
    return NextResponse.json(
      { error: "A rematrícula deve apontar para um ano letivo posterior ao da matrícula atual." },
      { status: 400 },
    );
  }

  if (targetClass.capacity && targetClass._count.enrollments >= targetClass.capacity) {
    return NextResponse.json({ error: "A turma de destino atingiu a capacidade cadastrada." }, { status: 409 });
  }

  const targetYearEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: source.studentId,
      status: { in: ["ACTIVE", "PENDING"] },
      class: {
        schoolId: session.schoolId,
        schoolYear: targetClass.schoolYear,
      },
    },
  });

  if (targetYearEnrollment) {
    return NextResponse.json(
      { error: "O aluno já possui matrícula ativa ou pendente no ano letivo de destino." },
      { status: 409 },
    );
  }

  const duplicate = await prisma.enrollment.findUnique({
    where: {
      studentId_classId: {
        studentId: source.studentId,
        classId: targetClass.id,
      },
    },
  });

  if (duplicate) {
    return NextResponse.json({ error: "O aluno já possui histórico na turma de destino." }, { status: 409 });
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: source.studentId,
      classId: targetClass.id,
      type: "REENROLLMENT",
      status: body?.status === "PENDING" ? "PENDING" : "ACTIVE",
      previousEnrollmentId: source.id,
      notes: body?.notes?.trim() || null,
      startedAt: body?.startedAt ? new Date(body.startedAt) : new Date(),
    },
    include: {
      student: true,
      class: true,
      previousEnrollment: { include: { class: true } },
    },
  });

  return NextResponse.json({ enrollment }, { status: 201 });
}
