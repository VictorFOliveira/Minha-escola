import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const contract = await prisma.billingContract.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contrato financeiro não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = body?.type === "SCHOLARSHIP" ? "SCHOLARSHIP" : "DISCOUNT";
  const valueType =
    body?.valueType === "FIXED" ? "FIXED" : "PERCENTAGE";
  const value = Number(body?.value);
  const startsAt = body?.startsAt
    ? new Date(String(body.startsAt) + "T12:00:00.000Z")
    : null;
  const endsAt = body?.endsAt
    ? new Date(String(body.endsAt) + "T12:00:00.000Z")
    : null;

  if (
    !name ||
    !(value > 0) ||
    (valueType === "PERCENTAGE" && value > 100) ||
    (startsAt && Number.isNaN(startsAt.getTime())) ||
    (endsAt && Number.isNaN(endsAt.getTime())) ||
    (startsAt && endsAt && endsAt < startsAt)
  ) {
    return NextResponse.json({ error: "Benefício financeiro inválido." }, { status: 400 });
  }

  const existingCharges = await prisma.charge.count({
    where: { contractId: id },
  });

  if (existingCharges > 0) {
    return NextResponse.json(
      { error: "O contrato já possui cobranças geradas. Ajuste as cobranças individualmente ou recrie o contrato antes de adicionar o benefício." },
      { status: 409 },
    );
  }

  const benefit = await prisma.billingBenefit.create({
    data: {
      contractId: id,
      name,
      type,
      valueType,
      value,
      startsAt,
      endsAt,
    },
  });

  return NextResponse.json({ benefit }, { status: 201 });
}
