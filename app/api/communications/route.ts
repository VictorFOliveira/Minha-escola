import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { canCreateAudience } from "@/lib/communication";

const roles = ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER", "FINANCE"];
const audiences = [
  "SCHOOL",
  "STAFF",
  "STUDENTS",
  "GUARDIANS",
  "FINANCIAL_GUARDIANS",
  "CLASS_STUDENTS",
  "CLASS_GUARDIANS",
  "CLASS_BOTH",
  "INDIVIDUAL_STUDENT",
  "INDIVIDUAL_GUARDIAN",
];

function validUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const communications = await prisma.communication.findMany({
    where: {
      schoolId: session.schoolId,
      ...(session.role === "TEACHER"
        ? { authorUserId: session.id }
        : {}),
      ...(session.role === "FINANCE"
        ? {
            OR: [
              { authorUserId: session.id },
              { audience: "FINANCIAL_GUARDIANS" },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, role: true } },
      targetClass: { select: { id: true, name: true, schoolYear: true } },
      attachments: true,
      _count: {
        select: {
          recipients: true,
          authorizationRequests: true,
        },
      },
    },
  });

  return NextResponse.json({ communications });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const audience = audiences.includes(body?.audience) ? body.audience : "";

  if (!title || !content || !audience) {
    return NextResponse.json(
      { error: "Título, conteúdo e público são obrigatórios." },
      { status: 400 },
    );
  }

  if (!canCreateAudience(session, audience)) {
    return NextResponse.json(
      { error: "Seu perfil não pode publicar para este público." },
      { status: 403 },
    );
  }

  const attachments = Array.isArray(body?.attachments)
    ? body.attachments
        .filter(
          (item: any) =>
            item &&
            typeof item.name === "string" &&
            item.name.trim() &&
            typeof item.url === "string" &&
            validUrl(item.url),
        )
        .slice(0, 10)
    : [];

  const communication = await prisma.communication.create({
    data: {
      schoolId: session.schoolId,
      authorUserId: session.id,
      title,
      content,
      priority: ["NORMAL", "IMPORTANT", "URGENT"].includes(body?.priority)
        ? body.priority
        : "NORMAL",
      audience,
      targetClassId: body?.targetClassId || null,
      targetEnrollmentId: body?.targetEnrollmentId || null,
      targetGuardianId: body?.targetGuardianId || null,
      requiresAcknowledgement: Boolean(body?.requiresAcknowledgement),
      requiresAuthorization: Boolean(body?.requiresAuthorization),
      expiresAt: body?.expiresAt
        ? new Date(String(body.expiresAt) + "T23:59:59.000Z")
        : null,
      attachments: {
        create: attachments.map((item: any) => ({
          schoolId: session.schoolId,
          name: String(item.name).trim(),
          url: String(item.url).trim(),
          mimeType: item.mimeType ? String(item.mimeType).trim() : null,
        })),
      },
    },
    include: {
      attachments: true,
    },
  });

  return NextResponse.json({ communication }, { status: 201 });
}
