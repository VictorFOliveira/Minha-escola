import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const settings = await prisma.communicationSettings.findUnique({
    where: { schoolId: session.schoolId },
  });

  return NextResponse.json({
    settings:
      settings || {
        schoolId: session.schoolId,
        portalEnabled: true,
        emailEnabled: false,
        whatsappEnabled: false,
        emailProvider: null,
        whatsappProvider: null,
      },
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode alterar os canais." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  const settings = await prisma.communicationSettings.upsert({
    where: { schoolId: session.schoolId },
    update: {
      portalEnabled: body?.portalEnabled !== false,
      emailEnabled: Boolean(body?.emailEnabled),
      whatsappEnabled: Boolean(body?.whatsappEnabled),
      emailProvider: body?.emailProvider ? String(body.emailProvider).trim() : null,
      whatsappProvider: body?.whatsappProvider ? String(body.whatsappProvider).trim() : null,
    },
    create: {
      schoolId: session.schoolId,
      portalEnabled: body?.portalEnabled !== false,
      emailEnabled: Boolean(body?.emailEnabled),
      whatsappEnabled: Boolean(body?.whatsappEnabled),
      emailProvider: body?.emailProvider ? String(body.emailProvider).trim() : null,
      whatsappProvider: body?.whatsappProvider ? String(body.whatsappProvider).trim() : null,
    },
  });

  return NextResponse.json({ settings });
}
