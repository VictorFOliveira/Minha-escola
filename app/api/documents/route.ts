import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
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

    return NextResponse.json({ document }, { status: 201 });
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
