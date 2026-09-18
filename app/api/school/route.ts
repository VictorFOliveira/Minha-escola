import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const school = await prisma.school.findUnique({ where: { id: session.schoolId } });
  if (!school) return NextResponse.json({ error: "Escola não encontrada." }, { status: 404 });

  return NextResponse.json({ school });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  for (const field of ["name", "document", "email", "phone", "address", "city", "state", "zipCode"]) {
    if (body?.[field] !== undefined) data[field] = body[field] ? String(body[field]).trim() : null;
  }

  if (data.name === null || data.name === "") {
    return NextResponse.json({ error: "Nome da escola é obrigatório." }, { status: 400 });
  }

  const school = await prisma.school.update({
    where: { id: session.schoolId },
    data,
  });

  return NextResponse.json({ school });
}
