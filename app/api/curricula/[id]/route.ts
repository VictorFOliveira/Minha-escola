import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

type SubjectInput = {
  subjectId?: unknown;
  weeklyClasses?: unknown;
  workloadHours?: unknown;
};

function normalizeLines(value: unknown) {
  if (!Array.isArray(value)) return null;

  return value
    .map((line: SubjectInput) => ({
      subjectId: typeof line?.subjectId === "string" ? line.subjectId : "",
      weeklyClasses:
        line?.weeklyClasses === "" || line?.weeklyClasses == null
          ? null
          : Number(line.weeklyClasses),
      workloadHours:
        line?.workloadHours === "" || line?.workloadHours == null
          ? null
          : Number(line.workloadHours),
    }))
    .filter((line) => line.subjectId);
}

function validPositiveInt(value: number | null) {
  return value === null || (Number.isInteger(value) && value > 0);
}

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.curriculum.findFirst({
    where: { id, schoolId: session.schoolId },
    include: { classes: { select: { id: true } } },
  });

  if (!current) return NextResponse.json({ error: "Grade curricular não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: { name?: string; gradeLevel?: string; schoolYear?: number; active?: boolean } = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nome da grade é obrigatório." }, { status: 400 });
    data.name = name;
  }

  if (body?.gradeLevel !== undefined) {
    const gradeLevel = String(body.gradeLevel).trim();
    if (!gradeLevel) return NextResponse.json({ error: "Série/etapa é obrigatória." }, { status: 400 });
    data.gradeLevel = gradeLevel;
  }

  if (body?.schoolYear !== undefined) {
    const year = Number(body.schoolYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Ano letivo inválido." }, { status: 400 });
    }
    data.schoolYear = year;
  }

  if (typeof body?.active === "boolean") data.active = body.active;

  const lines = normalizeLines(body?.subjects);

  if (lines !== null) {
    if (!lines.length) {
      return NextResponse.json({ error: "A grade precisa ter pelo menos uma disciplina." }, { status: 400 });
    }

    if (new Set(lines.map((line) => line.subjectId)).size !== lines.length) {
      return NextResponse.json({ error: "A mesma disciplina não pode aparecer duas vezes." }, { status: 400 });
    }

    if (lines.some((line) => !validPositiveInt(line.weeklyClasses) || !validPositiveInt(line.workloadHours))) {
      return NextResponse.json({ error: "Carga horária inválida." }, { status: 400 });
    }

    const subjects = await prisma.subject.findMany({
      where: {
        schoolId: session.schoolId,
        id: { in: lines.map((line) => line.subjectId) },
        active: true,
      },
      select: { id: true },
    });

    if (subjects.length !== lines.length) {
      return NextResponse.json({ error: "Há disciplina inválida ou inativa na grade." }, { status: 400 });
    }
  }

  const targetGrade = data.gradeLevel ?? current.gradeLevel;
  const targetYear = data.schoolYear ?? current.schoolYear;

  const duplicate = await prisma.curriculum.findFirst({
    where: {
      id: { not: id },
      schoolId: session.schoolId,
      gradeLevel: targetGrade,
      schoolYear: targetYear,
    },
  });

  if (duplicate) {
    return NextResponse.json({ error: "Já existe outra grade para esta série/etapa e ano." }, { status: 409 });
  }

  const curriculum = await prisma.$transaction(async (tx) => {
    await tx.curriculum.update({ where: { id }, data });

    if (lines !== null) {
      const ids = lines.map((line) => line.subjectId);

      await tx.curriculumSubject.deleteMany({
        where: { curriculumId: id, subjectId: { notIn: ids } },
      });

      for (const line of lines) {
        await tx.curriculumSubject.upsert({
          where: {
            curriculumId_subjectId: {
              curriculumId: id,
              subjectId: line.subjectId,
            },
          },
          update: {
            weeklyClasses: line.weeklyClasses,
            workloadHours: line.workloadHours,
          },
          create: {
            curriculumId: id,
            subjectId: line.subjectId,
            weeklyClasses: line.weeklyClasses,
            workloadHours: line.workloadHours,
          },
        });
      }

      for (const classGroup of current.classes) {
        await tx.classSubject.deleteMany({
          where: { classId: classGroup.id, subjectId: { notIn: ids } },
        });

        for (const line of lines) {
          await tx.classSubject.upsert({
            where: {
              classId_subjectId: {
                classId: classGroup.id,
                subjectId: line.subjectId,
              },
            },
            update: { weeklyClasses: line.weeklyClasses },
            create: {
              classId: classGroup.id,
              subjectId: line.subjectId,
              weeklyClasses: line.weeklyClasses,
            },
          });
        }
      }
    }

    return tx.curriculum.findUniqueOrThrow({
      where: { id },
      include: {
        subjects: {
          orderBy: { subject: { name: "asc" } },
          include: { subject: true },
        },
        _count: { select: { classes: true } },
      },
    });
  });

  return NextResponse.json({ curriculum });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.curriculum.findFirst({
    where: { id, schoolId: session.schoolId },
    include: { _count: { select: { classes: true } } },
  });

  if (!current) return NextResponse.json({ error: "Grade curricular não encontrada." }, { status: 404 });

  if (current._count.classes > 0) {
    return NextResponse.json(
      { error: "A grade está vinculada a turmas. Desative-a em vez de excluir." },
      { status: 409 },
    );
  }

  await prisma.curriculum.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
