import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const readRoles = ["ADMIN", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "SECRETARY"];

function parseYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function parseCapacity(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const capacity = Number(value);
  return Number.isInteger(capacity) && capacity > 0 ? capacity : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const classes = await prisma.classGroup.findMany({
    where: { schoolId: session.schoolId },
    orderBy: [{ schoolYear: "desc" }, { gradeLevel: "asc" }, { name: "asc" }],
    include: {
      teacher: true,
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json({ classes });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const gradeLevel = typeof body?.gradeLevel === "string" ? body.gradeLevel.trim() : "";
  const shift = typeof body?.shift === "string" ? body.shift.trim() : "";
  const schoolYear = parseYear(body?.schoolYear);
  const capacity = parseCapacity(body?.capacity);

  if (!name || !gradeLevel || !shift || !schoolYear) {
    return NextResponse.json(
      { error: "Nome, série/etapa, turno e ano letivo são obrigatórios." },
      { status: 400 },
    );
  }

  let teacherId: string | null = null;
  if (body?.teacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: String(body.teacherId),
        schoolId: session.schoolId,
        status: "ACTIVE",
      },
    });
    if (!teacher) {
      return NextResponse.json({ error: "Professor inválido para esta escola." }, { status: 400 });
    }
    teacherId = teacher.id;
  }

  const classGroup = await prisma.classGroup.create({
    data: {
      schoolId: session.schoolId,
      name,
      gradeLevel,
      shift,
      room: body?.room?.trim() || null,
      schoolYear,
      capacity,
      teacherId,
    },
    include: { teacher: true, _count: { select: { enrollments: true } } },
  });

  return NextResponse.json({ class: classGroup }, { status: 201 });
}
