import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(10, Number(url.searchParams.get("limit") || 30)),
  );

  const events = await prisma.securityEvent.findMany({
    where:
      session.role === "ADMIN"
        ? { schoolId: session.schoolId }
        : {
            schoolId: session.schoolId,
            userId: session.id,
          },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      severity: true,
      requestId: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
      user:
        session.role === "ADMIN"
          ? { select: { id: true, name: true, email: true } }
          : false,
    },
  });

  return NextResponse.json({ events });
}
