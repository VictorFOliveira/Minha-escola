import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.subject.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!current) return NextResponse.json({ error: "Disciplina não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: { name?: string; code?: string | null; active?: boolean } = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nome da disciplina é obrigatório." }, { status: 400 });
    data.name = name;
  }

  if (body?.code !== undefined) {
    data.code = body.code ? String(body.code).trim().toUpperCase() : null;
  }

  if (typeof body?.active === "boolean") data.active = body.active;

  const subject = await prisma.subject.update({
    where: { id },
    data,
  });

  return NextResponse.json({ subject });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const subject = await prisma.subject.findFirst({
    where: { id, schoolId: session.schoolId },
    include: {
      _count: {
        select: {
          curriculumSubjects: true,
          classSubjects: true,
        },
      },
    },
  });

  if (!subject) return NextResponse.json({ error: "Disciplina não encontrada." }, { status: 404 });

  if (subject._count.curriculumSubjects > 0 || subject._count.classSubjects > 0) {
    return NextResponse.json(
      { error: "A disciplina já faz parte de uma grade ou turma. Desative-a em vez de excluir." },
      { status: 409 },
    );
  }

  await prisma.subject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
