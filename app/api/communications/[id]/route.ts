import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const current = await prisma.communication.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      ...(session.role === "TEACHER" || session.role === "FINANCE"
        ? { authorUserId: session.id }
        : {}),
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Comunicado não encontrado ou sem acesso." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  if (body?.status === "ARCHIVED") {
    const communication = await prisma.communication.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ communication });
  }

  return NextResponse.json({ error: "Alteração não suportada." }, { status: 400 });
}
