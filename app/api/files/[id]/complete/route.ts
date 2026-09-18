import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { headStoredObject } from "@/lib/storage";
import { auditUserAction } from "@/lib/audit";
import {
  malwareScannerConfigured,
  malwareScanRequired,
  requestMalwareScan,
} from "@/lib/malware-scan";

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

    let updated;

    if (malwareScannerConfigured()) {
      updated = await prisma.fileAsset.update({
        where: { id: asset.id },
        data: {
          status: "PENDING",
          scanStatus: "PENDING",
        },
      });

      try {
        await requestMalwareScan(asset.id);
      } catch (error) {
        updated = await prisma.fileAsset.update({
          where: { id: asset.id },
          data: {
            scanStatus: "FAILED",
            scanResult:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : "Falha ao solicitar análise.",
          },
        });

        if (malwareScanRequired()) {
          return NextResponse.json(
            {
              error:
                "Upload recebido, mas o scanner obrigatório não pôde analisar o arquivo.",
              asset: updated,
            },
            { status: 503 },
          );
        }
      }
    } else if (malwareScanRequired()) {
      updated = await prisma.fileAsset.update({
        where: { id: asset.id },
        data: {
          status: "PENDING",
          scanStatus: "FAILED",
          scanResult: "Scanner obrigatório não configurado.",
        },
      });

      return NextResponse.json(
        {
          error:
            "Scanner de malware obrigatório não está configurado.",
          asset: updated,
        },
        { status: 503 },
      );
    } else {
      updated = await prisma.fileAsset.update({
        where: { id: asset.id },
        data: {
          status: "READY",
          readyAt: new Date(),
          scanStatus: "SKIPPED",
          scanResult:
            "Scanner externo não configurado; política permitiu publicação.",
          scannedAt: new Date(),
        },
      });
    }

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "FILE_UPLOAD_COMPLETE",
      entityType: "FileAsset",
      entityId: asset.id,
      metadata: {
        originalName: asset.originalName,
        sizeBytes: asset.sizeBytes,
        scanStatus: updated.scanStatus,
      },
    }).catch(() => null);

    return NextResponse.json({
      asset: updated,
      available: updated.status === "READY",
    });
  } catch {
    return NextResponse.json(
      { error: "Arquivo ainda não está disponível no storage." },
      { status: 409 },
    );
  }
}
