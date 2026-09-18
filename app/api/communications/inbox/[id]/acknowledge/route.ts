import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

function recipientAccess(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  if (session.role === "GUARDIAN" && session.guardianId) {
    return { guardianId: session.guardianId };
  }
  if (session.role === "STUDENT" && session.enrollmentId) {
    return { enrollmentId: session.enrollmentId };
  }
  return { userId: session.id };
}

export async function POST(_: Request, context: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const recipient = await prisma.communicationRecipient.findFirst({
    where: {
      id,
      ...recipientAccess(session),
      communication: {
        schoolId: session.schoolId,
        status: "PUBLISHED",
        requiresAcknowledgement: true,
      },
    },
  });

  if (!recipient) {
    return NextResponse.json(
      { error: "Confirmação não disponível para este comunicado." },
      { status: 404 },
    );
  }

  const now = new Date();
  const updated = await prisma.communicationRecipient.update({
    where: { id: recipient.id },
    data: {
      readAt: recipient.readAt || now,
      acknowledgedAt: recipient.acknowledgedAt || now,
    },
  });

  return NextResponse.json({ recipient: updated });
}
