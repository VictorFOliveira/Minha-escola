import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { auditUserAction } from "@/lib/audit";
import {
  idempotencyHash,
  readIdempotency,
  saveIdempotency,
} from "@/lib/idempotency";
import { emitSchoolEvent } from "@/lib/outgoing-webhooks";
import {
  buildSchoolDocument,
  type SchoolDocumentKind,
} from "@/lib/school-documents";

const types: SchoolDocumentKind[] = [
  "ENROLLMENT_DECLARATION",
  "ATTENDANCE_DECLARATION",
  "REPORT_CARD",
  "SCHOOL_RECORD",
  "PAYMENT_RECEIPT",
  "ENROLLMENT_CONTRACT",
  "CUSTOM",
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const documents = await prisma.schoolDocument.findMany({
    where: {
      schoolId: session.schoolId,
      ...(session.role === "FINANCE"
        ? { type: "PAYMENT_RECEIPT" }
        : {}),
    },
    orderBy: { issuedAt: "desc" },
    take: 250,
    include: {
      student: { select: { id: true, name: true, registration: true } },
      guardian: { select: { id: true, name: true } },
      issuedBy: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "COORDINATOR", "SECRETARY", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const operation = "document.issue";
  const previous = await readIdempotency(
    request,
    session.schoolId,
    operation,
  ).catch(() => null);

  if (previous?.responseBody && previous.responseStatus) {
    return NextResponse.json(previous.responseBody, {
      status: previous.responseStatus,
      headers: { "Idempotent-Replay": "true" },
    });
  }

  const keyHash = idempotencyHash(
    request,
    session.schoolId,
    operation,
  );

  const body = await request.json().catch(() => null);
  const type = types.includes(body?.type) ? body.type : null;

  if (!type) {
    return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
  }

  if (session.role === "FINANCE" && type !== "PAYMENT_RECEIPT") {
    return NextResponse.json(
      { error: "O perfil Financeiro só pode emitir recibos de pagamento." },
      { status: 403 },
    );
  }

  try {
    const built = await buildSchoolDocument({
      schoolId: session.schoolId,
      issuedByUserId: session.id,
      type,
      enrollmentId:
        typeof body?.enrollmentId === "string" ? body.enrollmentId : null,
      chargeId:
        typeof body?.chargeId === "string" ? body.chargeId : null,
      guardianId:
        typeof body?.guardianId === "string" ? body.guardianId : null,
      customTitle:
        typeof body?.customTitle === "string" ? body.customTitle : null,
      customContent:
        typeof body?.customContent === "string" ? body.customContent : null,
    });

    const document = await prisma.schoolDocument.create({
      data: built.data,
      include: {
        student: { select: { id: true, name: true, registration: true } },
        guardian: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, name: true, role: true } },
      },
    });

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "DOCUMENT_ISSUE",
      entityType: "SchoolDocument",
      entityId: document.id,
      metadata: { type: document.type, verificationCode: document.verificationCode },
    }).catch(() => null);

    const responseBody = { document };

    await Promise.all([
      saveIdempotency({
        schoolId: session.schoolId,
        operation,
        keyHash,
        responseStatus: 201,
        responseBody,
        resourceId: document.id,
      }).catch(() => null),
      emitSchoolEvent({
        schoolId: session.schoolId,
        eventType: "document.issued",
        payload: {
          documentId: document.id,
          type: document.type,
          studentId: document.studentId,
          enrollmentId: document.enrollmentId,
          verificationCode: document.verificationCode,
        },
      }).catch(() => null),
    ]);

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível emitir o documento.",
      },
      { status: 409 },
    );
  }
}
