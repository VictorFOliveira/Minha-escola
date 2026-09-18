import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const readRoles = ["ADMIN", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "SECRETARY"];

type SubjectInput = {
  subjectId?: unknown;
  weeklyClasses?: unknown;
  workloadHours?: unknown;
};

function normalizeLines(value: unknown) {
  if (!Array.isArray(value)) return [];

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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const curricula = await prisma.curriculum.findMany({
    where: { schoolId: session.schoolId },
    orderBy: [{ schoolYear: "desc" }, { gradeLevel: "asc" }],
    include: {
      subjects: {
        orderBy: { subject: { name: "asc" } },
        include: { subject: true },
      },
      _count: { select: { classes: true } },
    },
  });

  return NextResponse.json({ curricula });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const gradeLevel = typeof body?.gradeLevel === "string" ? body.gradeLevel.trim() : "";
  const schoolYear = Number(body?.schoolYear);
  const lines = normalizeLines(body?.subjects);

  if (!name || !gradeLevel || !Number.isInteger(schoolYear) || schoolYear < 2000 || schoolYear > 2100) {
    return NextResponse.json({ error: "Nome, série/etapa e ano letivo são obrigatórios." }, { status: 400 });
  }

  if (!lines.length) {
    return NextResponse.json({ error: "Adicione pelo menos uma disciplina à grade." }, { status: 400 });
  }

  if (new Set(lines.map((line) => line.subjectId)).size !== lines.length) {
    return NextResponse.json({ error: "A mesma disciplina não pode aparecer duas vezes." }, { status: 400 });
  }

  if (lines.some((line) => !validPositiveInt(line.weeklyClasses) || !validPositiveInt(line.workloadHours))) {
    return NextResponse.json({ error: "Carga horária deve usar números inteiros positivos." }, { status: 400 });
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

  const duplicate = await prisma.curriculum.findUnique({
    where: {
      schoolId_gradeLevel_schoolYear: {
        schoolId: session.schoolId,
        gradeLevel,
        schoolYear,
      },
    },
  });

  if (duplicate) {
    return NextResponse.json({ error: "Já existe uma grade para esta série/etapa e ano." }, { status: 409 });
  }

  const curriculum = await prisma.curriculum.create({
    data: {
      schoolId: session.schoolId,
      name,
      gradeLevel,
      schoolYear,
      subjects: {
        create: lines.map((line) => ({
          subjectId: line.subjectId,
          weeklyClasses: line.weeklyClasses,
          workloadHours: line.workloadHours,
        })),
      },
    },
    include: {
      subjects: { include: { subject: true } },
      _count: { select: { classes: true } },
    },
  });

  return NextResponse.json({ curriculum }, { status: 201 });
}
