import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-session";

export async function GET() {
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        include: { plan: true },
      },
      _count: {
        select: {
          students: true,
          users: true,
          classes: true,
        },
      },
    },
  });

  return NextResponse.json({ schools });
}
