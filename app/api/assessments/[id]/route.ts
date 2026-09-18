import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canAccessClassSubject } from "@/lib/academic-access";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.assessment.findUnique({
    where: { id },
    include: { classSubject: { include: { class: true } } },
  });

  if (!current) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });

  const access = await canAccessClassSubject(session, current.classSubjectId);
  if (!access) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
    data.title = title;
  }

  if (body?.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (["EXAM", "QUIZ", "ASSIGNMENT", "PROJECT", "PARTICIPATION", "OTHER"].includes(body?.type)) data.type = body.type;
  if (["DRAFT", "PUBLISHED", "CLOSED"].includes(body?.status)) data.status = body.status;

  if (body?.assessmentDate !== undefined) {
    const date = new Date(body.assessmentDate);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    data.assessmentDate = date;
  }

  if (body?.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }

  if (body?.maxScore !== undefined) {
    const value = Number(body.maxScore);
    if (!(value > 0)) return NextResponse.json({ error: "Nota máxima inválida." }, { status: 400 });
    data.maxScore = value;
  }

  if (body?.weight !== undefined) {
    const value = Number(body.weight);
    if (!(value > 0)) return NextResponse.json({ error: "Peso inválido." }, { status: 400 });
    data.weight = value;
  }

  const assessment = await prisma.assessment.update({
    where: { id },
    data,
    include: { period: true },
  });

  return NextResponse.json({ assessment });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "TEACHER"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.assessment.findUnique({
    where: { id },
    include: { _count: { select: { scores: true } } },
  });

  if (!current) return NextResponse.json({ error: "Avaliação não encontrada." }, { status: 404 });

  const access = await canAccessClassSubject(session, current.classSubjectId);
  if (!access) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  if (current._count.scores > 0) {
    return NextResponse.json(
      { error: "A avaliação já possui notas. Feche ou edite em vez de excluir." },
      { status: 409 },
    );
  }

  await prisma.assessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
