import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const relationship = typeof body?.relationship === "string" ? body.relationship.trim() : "";

  const [guardian, student] = await Promise.all([
    prisma.guardian.findFirst({ where: { id, schoolId: session.schoolId } }),
    prisma.student.findFirst({ where: { id: studentId, schoolId: session.schoolId } }),
  ]);

  if (!guardian || !student) {
    return NextResponse.json({ error: "Aluno ou responsável não encontrado." }, { status: 404 });
  }

  if (!relationship) {
    return NextResponse.json({ error: "Informe o parentesco/vínculo." }, { status: 400 });
  }

  const link = await prisma.studentGuardian.upsert({
    where: { studentId_guardianId: { studentId, guardianId: id } },
    update: {
      relationship,
      financialResponsible: Boolean(body?.financialResponsible),
      authorizedPickup: body?.authorizedPickup !== false,
    },
    create: {
      studentId,
      guardianId: id,
      relationship,
      financialResponsible: Boolean(body?.financialResponsible),
      authorizedPickup: body?.authorizedPickup !== false,
    },
  });

  return NextResponse.json({ link });
}

export async function DELETE(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");

  if (!studentId) return NextResponse.json({ error: "studentId é obrigatório." }, { status: 400 });

  const guardian = await prisma.guardian.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!guardian) return NextResponse.json({ error: "Responsável não encontrado." }, { status: 404 });

  await prisma.studentGuardian.deleteMany({ where: { guardianId: id, studentId } });
  return NextResponse.json({ ok: true });
}
