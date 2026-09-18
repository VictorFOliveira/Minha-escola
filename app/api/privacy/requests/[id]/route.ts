import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.dataPrivacyRequest.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const status = ["OPEN", "IN_REVIEW", "COMPLETED", "REJECTED"].includes(
    body?.status,
  )
    ? body.status
    : undefined;

  if (!status) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const updated = await prisma.dataPrivacyRequest.update({
    where: { id: current.id },
    data: {
      status,
      processedByUserId:
        status === "COMPLETED" || status === "REJECTED"
          ? session.id
          : current.processedByUserId,
      processedAt:
        status === "COMPLETED" || status === "REJECTED"
          ? new Date()
          : current.processedAt,
      resolution:
        typeof body?.resolution === "string" && body.resolution.trim()
          ? body.resolution.trim()
          : current.resolution,
    },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "PRIVACY_REQUEST_UPDATE",
    entityType: "DataPrivacyRequest",
    entityId: updated.id,
    metadata: { status: updated.status },
  }).catch(() => null);

  return NextResponse.json({ request: updated });
}
