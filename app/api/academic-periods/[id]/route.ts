import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.academicPeriod.findFirst({
    where: { id, schoolId: session.schoolId },
    include: {
      _count: {
        select: {
          assessments: true,
          lessons: true,
          periodGrades: true,
        },
      },
    },
  });

  if (!current) return NextResponse.json({ error: "Período letivo não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nome do período é obrigatório." }, { status: 400 });
    data.name = name;
  }

  if (body?.schoolYear !== undefined) {
    const year = Number(body.schoolYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Ano letivo inválido." }, { status: 400 });
    }
    data.schoolYear = year;
  }

  if (body?.order !== undefined) {
    const order = Number(body.order);
    if (!Number.isInteger(order) || order <= 0) {
      return NextResponse.json({ error: "Ordem inválida." }, { status: 400 });
    }
    data.order = order;
  }

  if (body?.startDate !== undefined) data.startDate = new Date(body.startDate);
  if (body?.endDate !== undefined) data.endDate = new Date(body.endDate);

  if (body?.weight !== undefined) {
    const weight = Number(body.weight);
    if (!(weight > 0)) {
      return NextResponse.json({ error: "Peso do período inválido." }, { status: 400 });
    }

    if (
      current._count.periodGrades > 0 &&
      Number(current.weight) !== weight
    ) {
      return NextResponse.json(
        { error: "O peso não pode ser alterado depois que o período possui médias fechadas." },
        { status: 409 },
      );
    }

    data.weight = weight;
  }

  if (["PLANNED", "ACTIVE", "CLOSED"].includes(body?.status)) {
    data.status = body.status;
  }

  const start = data.startDate instanceof Date ? data.startDate : current.startDate;
  const end = data.endDate instanceof Date ? data.endDate : current.endDate;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: "Intervalo de datas inválido." }, { status: 400 });
  }

  const period = await prisma.academicPeriod.update({
    where: { id },
    data,
  });

  return NextResponse.json({ period });
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.academicPeriod.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!current) return NextResponse.json({ error: "Período letivo não encontrado." }, { status: 404 });

  if (
    current._count.assessments > 0 ||
    current._count.lessons > 0 ||
    current._count.periodGrades > 0
  ) {
    return NextResponse.json(
      { error: "Este período já possui histórico acadêmico e não pode ser excluído." },
      { status: 409 },
    );
  }

  await prisma.academicPeriod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
