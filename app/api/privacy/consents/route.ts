import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const kinds = ["PRIVACY_POLICY", "TERMS_OF_USE", "COMMUNICATION"];

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const consents = await prisma.consentRecord.findMany({
    where: { userId: session.id },
    orderBy: { acceptedAt: "desc" },
  });

  return NextResponse.json({ consents });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kind = kinds.includes(body?.kind) ? body.kind : "";
  const version =
    typeof body?.version === "string" ? body.version.trim() : "";

  if (!kind || !version) {
    return NextResponse.json(
      { error: "Consentimento e versão são obrigatórios." },
      { status: 400 },
    );
  }

  const consent = await prisma.consentRecord.upsert({
    where: {
      userId_kind_version: {
        userId: session.id,
        kind,
        version,
      },
    },
    update: {
      revokedAt: null,
      acceptedAt: new Date(),
      userAgent: request.headers.get("user-agent"),
    },
    create: {
      userId: session.id,
      kind,
      version,
      userAgent: request.headers.get("user-agent"),
    },
  });

  return NextResponse.json({ consent }, { status: 201 });
}
