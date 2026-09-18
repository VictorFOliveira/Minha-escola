import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const allowedRoles = ["ADMIN", "SECRETARY"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const teachers = await prisma.teacher.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ teachers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const teacher = await prisma.teacher.create({
    data: {
      schoolId: session.schoolId,
      name,
      document: body?.document?.trim() || null,
      email: body?.email?.trim()?.toLowerCase() || null,
      phone: body?.phone?.trim() || null,
      specialty: body?.specialty?.trim() || null,
    },
  });

  return NextResponse.json({ teacher }, { status: 201 });
}
