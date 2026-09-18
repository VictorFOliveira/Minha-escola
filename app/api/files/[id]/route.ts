import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  createPresignedDownload,
  deleteStoredObject,
} from "@/lib/storage";
import { auditUserAction } from "@/lib/audit";

type Context = { params: Promise<{ id: string }> };

async function canReadAsset(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  assetId: string,
) {
  const asset = await prisma.fileAsset.findFirst({
    where: {
      id: assetId,
      schoolId: session.schoolId,
      status: "READY",
    },
  });

  if (!asset) return null;

  if (
    ["ADMIN", "COORDINATOR", "SECRETARY"].includes(session.role) ||
    asset.createdByUserId === session.id
  ) {
    return asset;
  }

  const recipientFilter =
    session.role === "GUARDIAN" && session.guardianId
      ? { guardianId: session.guardianId }
      : session.role === "STUDENT" && session.enrollmentId
        ? { enrollmentId: session.enrollmentId }
        : { userId: session.id };

  const attached = await prisma.communicationAttachment.findFirst({
    where: {
      fileAssetId: asset.id,
      communication: {
        schoolId: session.schoolId,
        status: "PUBLISHED",
        recipients: {
          some: recipientFilter,
        },
      },
    },
    select: { id: true },
  });

  return attached ? asset : null;
}

export async function GET(_: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await canReadAsset(session, id);

  if (!asset) {
    return NextResponse.json(
      { error: "Arquivo não encontrado ou sem acesso." },
      { status: 404 },
    );
  }

  const downloadUrl = await createPresignedDownload(
    asset.objectKey,
    asset.originalName,
  );

  return NextResponse.redirect(downloadUrl, 302);
}

export async function DELETE(_: Request, context: Context) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await prisma.fileAsset.findFirst({
    where: {
      id,
      schoolId: session.schoolId,
    },
    include: {
      _count: { select: { attachments: true } },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  if (
    session.role !== "ADMIN" &&
    session.role !== "COORDINATOR" &&
    asset.createdByUserId !== session.id
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (asset._count.attachments > 0) {
    return NextResponse.json(
      { error: "O arquivo está vinculado a comunicado e não pode ser excluído." },
      { status: 409 },
    );
  }

  if (asset.status !== "DELETED") {
    await deleteStoredObject(asset.objectKey).catch(() => null);

    await prisma.fileAsset.update({
      where: { id: asset.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
    });
  }

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "FILE_DELETE",
    entityType: "FileAsset",
    entityId: asset.id,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
