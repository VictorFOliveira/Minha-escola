import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { subjectForSession } from "@/lib/privacy";
import { auditUserAction } from "@/lib/audit";

const types = [
  "ACCESS_EXPORT",
  "CORRECTION",
  "ANONYMIZATION",
  "DELETION",
];

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    const requests = await prisma.dataPrivacyRequest.findMany({
      where: { schoolId: session.schoolId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  }

  const subject = await subjectForSession(session);

  const requests = await prisma.dataPrivacyRequest.findMany({
    where: {
      schoolId: session.schoolId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const settings = await prisma.privacySettings.findUnique({
    where: { schoolId: session.schoolId },
  });

  if (
    ["STUDENT", "GUARDIAN"].includes(session.role) &&
    settings?.allowPortalRequests === false
  ) {
    return NextResponse.json(
      { error: "Solicitações pelo portal estão desativadas nesta instituição." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const type = types.includes(body?.type) ? body.type : "";

  if (!type) {
    return NextResponse.json(
      { error: "Tipo de solicitação inválido." },
      { status: 400 },
    );
  }

  const subject =
    session.role === "ADMIN" &&
    ["STUDENT", "GUARDIAN", "USER"].includes(body?.subjectType) &&
    typeof body?.subjectId === "string" &&
    body.subjectId
      ? {
          subjectType: body.subjectType,
          subjectId: body.subjectId,
        }
      : await subjectForSession(session);

  const existing = await prisma.dataPrivacyRequest.findFirst({
    where: {
      schoolId: session.schoolId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      type,
      status: { in: ["OPEN", "IN_REVIEW"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma solicitação aberta deste tipo para o titular." },
      { status: 409 },
    );
  }

  const privacyRequest = await prisma.dataPrivacyRequest.create({
    data: {
      schoolId: session.schoolId,
      requestedByUserId: session.id,
      type,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      reason:
        typeof body?.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : null,
    },
  });

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "PRIVACY_REQUEST_CREATE",
    entityType: "DataPrivacyRequest",
    entityId: privacyRequest.id,
    metadata: {
      type,
      subjectType: subject.subjectType,
    },
  }).catch(() => null);

  return NextResponse.json({ request: privacyRequest }, { status: 201 });
}
