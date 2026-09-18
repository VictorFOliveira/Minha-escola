import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertSchoolFeature } from "@/lib/features";
import { API_SCOPES } from "@/lib/api-auth";
import { hashSecret, randomToken } from "@/lib/security-crypto";
import { auditUserAction } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const keys = await prisma.apiCredential.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      active: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  try {
    await assertSchoolFeature(session.schoolId, "api");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recurso indisponível." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const scopes = Array.isArray(body?.scopes)
    ? body.scopes.filter((scope: unknown) => typeof scope === "string" && API_SCOPES.includes(scope as any))
    : [];

  if (!name || !scopes.length) {
    return NextResponse.json(
      { error: "Nome e pelo menos um scope são obrigatórios." },
      { status: 400 },
    );
  }

  const raw = "me_sk_" + randomToken(32);
  const credential = await prisma.apiCredential.create({
    data: {
      schoolId: session.schoolId,
      createdByUserId: session.id,
      name,
      keyPrefix: raw.slice(0, 14),
      secretHash: hashSecret("api-key:" + raw),
      scopes,
      expiresAt: body?.expiresAt ? new Date(String(body.expiresAt) + "T23:59:59.000Z") : null,
    },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "API_KEY_CREATE",
    entityType: "ApiCredential",
    entityId: credential.id,
    metadata: { scopes },
  }).catch(() => null);

  return NextResponse.json({
    key: {
      id: credential.id,
      name: credential.name,
      keyPrefix: credential.keyPrefix,
      scopes: credential.scopes,
    },
    secret: raw,
  }, { status: 201 });
}
