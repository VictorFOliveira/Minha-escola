import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const allowedRoles = ["ADMIN", "SECRETARY"];
type Context = { params: Promise<{ id: string }> };

async function authorizedStudent(id: string, schoolId: string) {
  return prisma.student.findFirst({ where: { id, schoolId } });
}

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await authorizedStudent(id, session.schoolId);
  if (!current) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  for (const field of ["name", "registration", "document", "phone", "email", "address"]) {
    if (body?.[field] !== undefined) {
      data[field] = body[field] ? String(body[field]).trim() : null;
    }
  }

  if (body?.birthDate !== undefined) data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if (body?.status === "ACTIVE" || body?.status === "INACTIVE") data.status = body.status;

  const student = await prisma.student.update({ where: { id }, data });
  return NextResponse.json({ student });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await authorizedStudent(id, session.schoolId);
  if (!current) return NextResponse.json({ error: "Aluno não encontrado." }, { status: 404 });

  await prisma.student.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
