import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const allowedRoles = ["ADMIN", "SECRETARY"];
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.guardian.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!current) return NextResponse.json({ error: "Responsável não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  for (const field of ["name", "document", "phone", "email", "address"]) {
    if (body?.[field] !== undefined) data[field] = body[field] ? String(body[field]).trim() : null;
  }
  if (body?.status === "ACTIVE" || body?.status === "INACTIVE") data.status = body.status;

  const guardian = await prisma.guardian.update({ where: { id }, data });
  return NextResponse.json({ guardian });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.guardian.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!current) return NextResponse.json({ error: "Responsável não encontrado." }, { status: 404 });

  await prisma.guardian.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
