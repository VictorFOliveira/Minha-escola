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
  const credential = await prisma.apiCredential.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!credential) {
    return NextResponse.json({ error: "Credencial não encontrada." }, { status: 404 });
  }

  await prisma.apiCredential.update({
    where: { id },
    data: { active: false },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "API_KEY_REVOKE",
    entityType: "ApiCredential",
    entityId: id,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
