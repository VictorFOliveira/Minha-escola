import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { headStoredObject } from "@/lib/storage";
import { auditUserAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await prisma.fileAsset.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
      createdByUserId: session.id,
      status: "PENDING",
    },
  });

  if (!asset) {
    return NextResponse.json(
      { error: "Upload pendente não encontrado." },
      { status: 404 },
    );
  }

  try {
    const head = await headStoredObject(asset.objectKey);
    const remoteSize = Number(head.ContentLength || 0);
    const remoteType = head.ContentType || "";

    if (remoteSize !== asset.sizeBytes || remoteType !== asset.mimeType) {
      return NextResponse.json(
        { error: "O arquivo recebido não corresponde ao upload autorizado." },
        { status: 409 },
      );
    }

    const updated = await prisma.fileAsset.update({
      where: { id: asset.id },
      data: {
        status: "READY",
        readyAt: new Date(),
      },
    });

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "FILE_UPLOAD_COMPLETE",
      entityType: "FileAsset",
      entityId: asset.id,
      metadata: {
        originalName: asset.originalName,
        sizeBytes: asset.sizeBytes,
      },
    }).catch(() => null);

    return NextResponse.json({ asset: updated });
  } catch {
    return NextResponse.json(
      { error: "Arquivo ainda não está disponível no storage." },
      { status: 409 },
    );
  }
}
