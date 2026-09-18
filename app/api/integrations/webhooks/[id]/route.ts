import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const webhook = await prisma.outgoingWebhook.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Webhook não encontrado." }, { status: 404 });
  }

  await prisma.outgoingWebhook.update({
    where: { id },
    data: { active: false },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "WEBHOOK_DISABLE",
    entityType: "OutgoingWebhook",
    entityId: id,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
