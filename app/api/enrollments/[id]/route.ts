import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await context.params;
  const current = await prisma.enrollment.findFirst({
    where: {
      id,
      class: { schoolId: session.schoolId },
    },
  });
  if (!current) return NextResponse.json({ error: "Matrícula não encontrada." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const allowedStatuses = ["ACTIVE", "PENDING", "TRANSFERRED", "CANCELLED"];
  const data: Record<string, unknown> = {};

  if (body?.status !== undefined) {
    if (!allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    data.status = body.status;
    data.endedAt = ["TRANSFERRED", "CANCELLED"].includes(body.status)
      ? new Date()
      : null;
  }

  if (body?.notes !== undefined) {
    data.notes = body.notes ? String(body.notes).trim() : null;
  }

  const enrollment = await prisma.enrollment.update({
    where: { id },
    data,
    include: { student: true, class: true },
  });

  return NextResponse.json({ enrollment });
}
