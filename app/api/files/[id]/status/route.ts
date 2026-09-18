import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await prisma.fileAsset.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      ...(session.role === "ADMIN" || session.role === "COORDINATOR"
        ? {}
        : { createdByUserId: session.id }),
    },
    select: {
      id: true,
      status: true,
      scanStatus: true,
      scanResult: true,
      readyAt: true,
    },
  });

  if (!asset) {
    return NextResponse.json(
      { error: "Arquivo não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    asset,
    available: asset.status === "READY" && asset.scanStatus !== "INFECTED",
  });
}
