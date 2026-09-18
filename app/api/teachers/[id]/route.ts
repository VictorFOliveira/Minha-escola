import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.teacher.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!current) return NextResponse.json({ error: "Professor não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};
  for (const field of ["name", "document", "email", "phone", "specialty"]) {
    if (body?.[field] !== undefined) data[field] = body[field] ? String(body[field]).trim() : null;
  }
  if (body?.status === "ACTIVE" || body?.status === "INACTIVE") data.status = body.status;

  const teacher = await prisma.teacher.update({ where: { id }, data });
  return NextResponse.json({ teacher });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.teacher.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!current) return NextResponse.json({ error: "Professor não encontrado." }, { status: 404 });

  await prisma.teacher.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
