import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");

  const logs = await prisma.auditLog.findMany({
    where: {
      schoolId: session.schoolId,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      platformAdmin: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ logs });
}
