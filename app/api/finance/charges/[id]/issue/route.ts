import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  createAsaasCustomer,
  createAsaasPayment,
  getAsaasPixQrCode,
} from "@/lib/asaas";
import { roundMoney } from "@/lib/finance";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const [charge, settings] = await Promise.all([
    prisma.charge.findFirst({
      where: { id, schoolId: session.schoolId },
      include: { guardian: true, student: true },
    }),
    prisma.financeSettings.findUnique({
      where: { schoolId: session.schoolId },
    }),
  ]);

  if (!charge) {
    return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
  }

  if (!settings?.gatewayEnabled || settings.provider === "MANUAL") {
    return NextResponse.json(
      { error: "A escola não possui gateway de pagamento ativado." },
      { status: 409 },
    );
  }

  if (charge.status === "PAID" || charge.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Esta cobrança não pode ser emitida novamente." },
      { status: 409 },
    );
  }

  if (settings.provider === "EXTERNAL") {
    const updated = await prisma.charge.update({
      where: { id: charge.id },
      data: {
        provider: "EXTERNAL",
        invoiceUrl: settings.externalPaymentUrl,
        externalStatus: "REDIRECT",
      },
    });

    return NextResponse.json({
      charge: updated,
      provider: "EXTERNAL",
      externalPaymentUrl: settings.externalPaymentUrl,
      message:
        "A escola utiliza um sistema próprio de pagamento. Nenhuma cobrança foi criada no Asaas.",
    });
  }

  if (!charge.guardian) {
    return NextResponse.json(
      { error: "A cobrança precisa estar vinculada ao responsável financeiro." },
      { status: 409 },
    );
  }

  if (charge.externalId && charge.provider === "ASAAS") {
    return NextResponse.json({
      charge,
      message: "Esta cobrança já foi emitida no Asaas.",
    });
  }

  const body = await request.json().catch(() => null);
  const billingType = ["PIX", "BOLETO", "UNDEFINED"].includes(body?.billingType)
    ? body.billingType
    : "UNDEFINED";

  let customer = await prisma.paymentCustomer.findUnique({
    where: {
      guardianId_provider: {
        guardianId: charge.guardian.id,
        provider: "ASAAS",
      },
    },
  });

  if (!customer) {
    const created = await createAsaasCustomer({
      name: charge.guardian.name,
      cpfCnpj: charge.guardian.document,
      mobilePhone: charge.guardian.phone,
      email: charge.guardian.email,
      externalReference: charge.guardian.id,
    });

    customer = await prisma.paymentCustomer.create({
      data: {
        schoolId: session.schoolId,
        guardianId: charge.guardian.id,
        provider: "ASAAS",
        externalId: created.id,
      },
    });
  }

  const remaining = roundMoney(
    Number(charge.amount) - Number(charge.paidAmount),
  );

  if (!(remaining > 0)) {
    return NextResponse.json({ error: "A cobrança não possui saldo em aberto." }, { status: 409 });
  }

  const payment = await createAsaasPayment({
    customer: customer.externalId,
    billingType,
    value: remaining,
    dueDate: charge.dueDate.toISOString().slice(0, 10),
    description: charge.description,
    externalReference: charge.id,
  });

  let pixCopyPaste: string | null = null;
  let pixQrCodeBase64: string | null = null;

  if (billingType === "PIX" || billingType === "UNDEFINED") {
    const pix = await getAsaasPixQrCode(payment.id).catch(() => null);
    pixCopyPaste = pix?.payload || null;
    pixQrCodeBase64 = pix?.encodedImage || null;
  }

  const updated = await prisma.charge.update({
    where: { id: charge.id },
    data: {
      provider: "ASAAS",
      paymentMethod:
        billingType === "PIX"
          ? "PIX"
          : billingType === "BOLETO"
            ? "BOLETO"
            : null,
      externalId: payment.id,
      externalStatus: payment.status || null,
      invoiceUrl: payment.invoiceUrl || null,
      bankSlipUrl: payment.bankSlipUrl || null,
      pixCopyPaste,
      pixQrCodeBase64,
    },
  });

  return NextResponse.json({
    charge: updated,
    provider: "ASAAS",
  });
}
