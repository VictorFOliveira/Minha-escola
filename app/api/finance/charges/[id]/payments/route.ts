import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getChargeStatus, roundMoney } from "@/lib/finance";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const charge = await prisma.charge.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!charge) {
    return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
  }

  if (charge.provider === "ASAAS" && charge.externalId) {
    return NextResponse.json(
      { error: "Esta cobrança está ativa no Asaas. Aguarde a conciliação pelo webhook para evitar pagamento duplicado." },
      { status: 409 },
    );
  }

  if (["CANCELLED", "REFUNDED"].includes(charge.status)) {
    return NextResponse.json(
      { error: "Esta cobrança não aceita novos pagamentos." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  const method = [
    "PIX",
    "BOLETO",
    "CREDIT_CARD",
    "CASH",
    "BANK_TRANSFER",
    "OTHER",
  ].includes(body?.method)
    ? body.method
    : "OTHER";
  const paidAt = body?.paidAt
    ? new Date(String(body.paidAt) + "T12:00:00.000Z")
    : new Date();

  const remaining = roundMoney(
    Number(charge.amount) - Number(charge.paidAmount),
  );

  if (
    !(amount > 0) ||
    amount > remaining ||
    Number.isNaN(paidAt.getTime())
  ) {
    return NextResponse.json(
      { error: "Valor do pagamento inválido para o saldo desta cobrança." },
      { status: 400 },
    );
  }

  const newPaidAmount = roundMoney(Number(charge.paidAmount) + amount);
  const nextStatus = getChargeStatus({
    amount: Number(charge.amount),
    paidAmount: newPaidAmount,
    dueDate: charge.dueDate,
    currentStatus: charge.status,
  });

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        chargeId: charge.id,
        amount,
        method,
        provider: "MANUAL",
        status: "RECEIVED",
        paidAt,
        recordedByUserId: session.id,
        note: body?.note ? String(body.note).trim() : null,
      },
    });

    const updatedCharge = await tx.charge.update({
      where: { id: charge.id },
      data: {
        paidAmount: newPaidAmount,
        paidAt: nextStatus === "PAID" ? paidAt : null,
        status: nextStatus,
        paymentMethod: method,
      },
    });

    return { payment, charge: updatedCharge };
  });

  return NextResponse.json(result, { status: 201 });
}
