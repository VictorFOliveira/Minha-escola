import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  buildObjectKey,
  createPresignedUpload,
  storageConfigured,
  validateUpload,
} from "@/lib/storage";
import { auditUserAction } from "@/lib/audit";

const allowedRoles = [
  "ADMIN",
  "COORDINATOR",
  "SECRETARY",
  "TEACHER",
  "FINANCE",
];

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Storage privado ainda não está configurado para esta instalação." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const originalName =
    typeof body?.originalName === "string" ? body.originalName.trim() : "";
  const mimeType =
    typeof body?.mimeType === "string" ? body.mimeType.trim() : "";
  const sizeBytes = Number(body?.sizeBytes);

  try {
    validateUpload({ originalName, mimeType, sizeBytes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Arquivo inválido.",
      },
      { status: 400 },
    );
  }

  const objectKey = buildObjectKey(session.schoolId, originalName);

  const asset = await prisma.fileAsset.create({
    data: {
      schoolId: session.schoolId,
      createdByUserId: session.id,
      objectKey,
      originalName,
      mimeType,
      sizeBytes,
    },
  });

  try {
    const uploadUrl = await createPresignedUpload({
      objectKey,
      mimeType,
    });

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "FILE_UPLOAD_PREPARE",
      entityType: "FileAsset",
      entityId: asset.id,
      metadata: { originalName, mimeType, sizeBytes },
    }).catch(() => null);

    return NextResponse.json({
      asset: {
        id: asset.id,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        status: asset.status,
      },
      uploadUrl,
      expiresInSeconds: 600,
      requiredHeaders: {
        "Content-Type": mimeType,
      },
    });
  } catch (error) {
    await prisma.fileAsset.delete({ where: { id: asset.id } }).catch(() => null);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o upload.",
      },
      { status: 503 },
    );
  }
}
