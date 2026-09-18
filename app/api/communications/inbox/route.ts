import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const recipientWhere =
    session.role === "GUARDIAN" && session.guardianId
      ? { guardianId: session.guardianId }
      : session.role === "STUDENT" && session.enrollmentId
        ? { enrollmentId: session.enrollmentId }
        : { userId: session.id };

  const recipients = await prisma.communicationRecipient.findMany({
    where: {
      ...recipientWhere,
      deliveries: {
        some: {
          channel: "PORTAL",
          status: "SENT",
        },
      },
      communication: {
        schoolId: session.schoolId,
        status: "PUBLISHED",
        OR: [
          { publishAt: null },
          { publishAt: { lte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
        ],
      },
    },
    orderBy: {
      communication: {
        publishAt: "desc",
      },
    },
    include: {
      communication: {
        include: {
          author: { select: { id: true, name: true, role: true } },
          attachments: {
            select: {
              id: true,
              name: true,
              url: true,
              mimeType: true,
              fileAssetId: true,
            },
          },
          targetClass: { select: { id: true, name: true, schoolYear: true } },
        },
      },
      deliveries: true,
    },
  });

  let authorizations: Array<any> = [];

  if (session.role === "GUARDIAN" && session.guardianId) {
    authorizations = await prisma.authorizationRequest.findMany({
      where: {
        guardianId: session.guardianId,
        communication: {
          schoolId: session.schoolId,
          status: "PUBLISHED",
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, name: true, registration: true } },
        communication: {
          select: {
            id: true,
            title: true,
            content: true,
            expiresAt: true,
            attachments: {
              select: {
                id: true,
                name: true,
                url: true,
                fileAssetId: true,
              },
            },
          },
        },
      },
    });
  }

  return NextResponse.json({
    inbox: recipients,
    authorizations,
    unread: recipients.filter((item) => !item.readAt).length,
  });
}
