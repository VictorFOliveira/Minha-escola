import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const readRoles = ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "COORDINATOR", "SECRETARY"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const subjects = await prisma.subject.findMany({
    where: { schoolId: session.schoolId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          curriculumSubjects: true,
          classSubjects: true,
        },
      },
    },
  });

  return NextResponse.json({ subjects });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!name) {
    return NextResponse.json({ error: "Nome da disciplina é obrigatório." }, { status: 400 });
  }

  const duplicate = await prisma.subject.findFirst({
    where: {
      schoolId: session.schoolId,
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        ...(code ? [{ code }] : []),
      ],
    },
  });

  if (duplicate) {
    return NextResponse.json({ error: "Já existe uma disciplina com este nome ou código." }, { status: 409 });
  }

  const subject = await prisma.subject.create({
    data: {
      schoolId: session.schoolId,
      name,
      code: code || null,
    },
  });

  return NextResponse.json({ subject }, { status: 201 });
}
