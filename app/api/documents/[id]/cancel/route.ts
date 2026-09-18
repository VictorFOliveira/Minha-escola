import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.schoolDocument.findFirst({
    where: { id, schoolId: session.schoolId },
  });

  if (!current) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  if (current.status === "CANCELLED") {
    return NextResponse.json({ document: current });
  }

  const body = await request.json().catch(() => null);
  const reason =
    typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Cancelado pela instituição.";

  const document = await prisma.schoolDocument.update({
    where: { id: current.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  return NextResponse.json({ document });
}
