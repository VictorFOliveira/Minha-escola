import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const roles = ["ADMIN", "FINANCE"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const plans = await prisma.billingPlan.findMany({
    where: { schoolId: session.schoolId },
    orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
    include: { _count: { select: { contracts: true } } },
  });

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const schoolYear = Number(body?.schoolYear);
  const installmentAmount = Number(body?.installmentAmount);
  const installments = Number(body?.installments ?? 12);
  const dueDay = Number(body?.dueDay);

  if (
    !name ||
    !Number.isInteger(schoolYear) ||
    schoolYear < 2000 ||
    schoolYear > 2100 ||
    !(installmentAmount > 0) ||
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > 24 ||
    !Number.isInteger(dueDay) ||
    dueDay < 1 ||
    dueDay > 31
  ) {
    return NextResponse.json(
      { error: "Preencha corretamente nome, ano, valor, parcelas e dia de vencimento." },
      { status: 400 },
    );
  }

  const plan = await prisma.billingPlan.create({
    data: {
      schoolId: session.schoolId,
      name,
      description: description || null,
      schoolYear,
      installmentAmount,
      installments,
      dueDay,
    },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
