import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const curriculumId = typeof body?.curriculumId === "string" ? body.curriculumId : "";

  const [classGroup, curriculum] = await Promise.all([
    prisma.classGroup.findFirst({
      where: { id, schoolId: session.schoolId },
    }),
    prisma.curriculum.findFirst({
      where: {
        id: curriculumId,
        schoolId: session.schoolId,
        active: true,
      },
      include: { subjects: true },
    }),
  ]);

  if (!classGroup || !curriculum) {
    return NextResponse.json({ error: "Turma ou grade curricular inválida." }, { status: 404 });
  }

  if (
    classGroup.schoolYear !== curriculum.schoolYear ||
    classGroup.gradeLevel.trim().toLowerCase() !== curriculum.gradeLevel.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "A grade deve ter o mesmo ano letivo e série/etapa da turma." },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.classGroup.update({
      where: { id: classGroup.id },
      data: { curriculumId: curriculum.id },
    });

    const ids = curriculum.subjects.map((item) => item.subjectId);

    await tx.classSubject.deleteMany({
      where: { classId: classGroup.id, subjectId: { notIn: ids } },
    });

    for (const item of curriculum.subjects) {
      await tx.classSubject.upsert({
        where: {
          classId_subjectId: {
            classId: classGroup.id,
            subjectId: item.subjectId,
          },
        },
        update: { weeklyClasses: item.weeklyClasses },
        create: {
          classId: classGroup.id,
          subjectId: item.subjectId,
          weeklyClasses: item.weeklyClasses,
        },
      });
    }

    return tx.classGroup.findUniqueOrThrow({
      where: { id: classGroup.id },
      include: {
        curriculum: true,
        classSubjects: {
          orderBy: { subject: { name: "asc" } },
          include: {
            subject: true,
            teacher: true,
            scheduleSlots: {
              orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
            },
          },
        },
      },
    });
  });

  return NextResponse.json({ class: updated });
}
