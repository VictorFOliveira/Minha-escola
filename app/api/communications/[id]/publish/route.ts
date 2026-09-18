import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { publishCommunication } from "@/lib/communication";
import { auditUserAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const { id } = await context.params;
  const communication = await prisma.communication.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      ...(session.role === "TEACHER" || session.role === "FINANCE"
        ? { authorUserId: session.id }
        : {}),
    },
  });

  if (!communication) {
    return NextResponse.json({ error: "Comunicado não encontrado ou sem acesso." }, { status: 404 });
  }

  if (communication.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Comunicado arquivado não pode ser publicado." },
      { status: 409 },
    );
  }

  if (communication.status === "PUBLISHED") {
    return NextResponse.json(
      { error: "Este comunicado já foi publicado. Crie um novo comunicado para preservar o histórico de leitura." },
      { status: 409 },
    );
  }

  try {
    const recipients = await publishCommunication(id, session);

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "COMMUNICATION_PUBLISH",
      entityType: "Communication",
      entityId: id,
      metadata: { recipients },
    }).catch(() => null);

    return NextResponse.json({ ok: true, recipients });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível publicar o comunicado.",
      },
      { status: 409 },
    );
  }
}
