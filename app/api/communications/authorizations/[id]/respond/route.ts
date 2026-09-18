import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role !== "GUARDIAN" || !session.guardianId) {
    return NextResponse.json(
      { error: "Somente o responsável pode responder esta autorização." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const decision =
    body?.status === "APPROVED"
      ? "APPROVED"
      : body?.status === "DENIED"
        ? "DENIED"
        : "";

  if (!decision) {
    return NextResponse.json(
      { error: "Informe APPROVED ou DENIED." },
      { status: 400 },
    );
  }

  const authorization = await prisma.authorizationRequest.findFirst({
    where: {
      id,
      guardianId: session.guardianId,
      communication: {
        schoolId: session.schoolId,
        status: "PUBLISHED",
      },
    },
    include: {
      communication: true,
    },
  });

  if (!authorization) {
    return NextResponse.json(
      { error: "Autorização não encontrada." },
      { status: 404 },
    );
  }

  if (authorization.status !== "PENDING") {
    return NextResponse.json(
      { error: "Esta autorização já foi respondida." },
      { status: 409 },
    );
  }

  if (
    authorization.communication.expiresAt &&
    authorization.communication.expiresAt < new Date()
  ) {
    await prisma.authorizationRequest.update({
      where: { id: authorization.id },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json(
      { error: "O prazo desta autorização expirou." },
      { status: 409 },
    );
  }

  const updated = await prisma.authorizationRequest.update({
    where: { id: authorization.id },
    data: {
      status: decision,
      responseNote:
        typeof body?.responseNote === "string" && body.responseNote.trim()
          ? body.responseNote.trim()
          : null,
      respondedAt: new Date(),
    },
  });

  return NextResponse.json({ authorization: updated });
}
