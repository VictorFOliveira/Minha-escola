import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";
import { issuePlatformInvoice } from "@/lib/platform-billing";
import { auditPlatformAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const admin = await getPlatformSession();

  if (!admin) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const subscription = await prisma.schoolSubscription.findUnique({
    where: { schoolId: id },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "A escola não possui assinatura." },
      { status: 404 },
    );
  }

  try {
    const result = await issuePlatformInvoice(subscription.id, {
      force: true,
    });

    await auditPlatformAction({
      platformAdminId: admin.id,
      schoolId: id,
      action: "PLATFORM_INVOICE_FORCE_ISSUE",
      entityType: "SchoolSubscription",
      entityId: subscription.id,
      metadata: {
        invoiceId: result.invoice?.id || null,
      },
    }).catch(() => null);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível emitir a cobrança.",
      },
      { status: 409 },
    );
  }
}
