import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";

export async function GET() {
  const session = await getPlatformSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const events = await prisma.securityEvent.findMany({
    where: { platformAdminId: session.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      eventType: true,
      severity: true,
      requestId: true,
      userAgent: true,
      schoolId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}
