import { NextResponse } from "next/server";
import type { ImportJobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertSchoolFeature } from "@/lib/features";
import {
  parseImportFile,
  processImportRows,
  type ImportType,
} from "@/lib/imports";
import { auditUserAction } from "@/lib/audit";

const allowedTypes: ImportType[] = [
  "STUDENTS",
  "GUARDIANS",
  "TEACHERS",
  "CLASSES",
  "ENROLLMENTS",
];

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const jobs = await prisma.importJob.findMany({
    where: { schoolId: session.schoolId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    await assertSchoolFeature(session.schoolId, "bulkImport");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recurso indisponível." },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const type = String(form.get("type") || "") as ImportType;
  const file = form.get("file");

  if (!allowedTypes.includes(type)) {
    return NextResponse.json({ error: "Tipo de importação inválido." }, { status: 400 });
  }

  if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Envie CSV/XLSX com no máximo 8 MB." },
      { status: 400 },
    );
  }

  const job = await prisma.importJob.create({
    data: {
      schoolId: session.schoolId,
      createdByUserId: session.id,
      type: type as ImportJobType,
      status: "PROCESSING",
      sourceName: file.name,
    },
  });

  try {
    const rows = await parseImportFile({
      type,
      name: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    });

    if (rows.length > 10000) {
      throw new Error("A importação está limitada a 10.000 linhas por arquivo.");
    }

    const result = await processImportRows({
      schoolId: session.schoolId,
      type,
      rows,
    });

    const updated = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: result.failedRows ? "COMPLETED" : "COMPLETED",
        totalRows: result.totalRows,
        processedRows: result.totalRows,
        successRows: result.successRows,
        failedRows: result.failedRows,
        errors: result.errors,
        completedAt: new Date(),
      },
    });

    await auditUserAction({
      schoolId: session.schoolId,
      userId: session.id,
      action: "BULK_IMPORT",
      entityType: "ImportJob",
      entityId: job.id,
      metadata: {
        type,
        totalRows: result.totalRows,
        successRows: result.successRows,
        failedRows: result.failedRows,
      },
    }).catch(() => null);

    return NextResponse.json({
      job: updated,
      ...result,
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errors: [
          {
            row: 0,
            message:
              error instanceof Error ? error.message : "Falha na importação.",
          },
        ],
        completedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Falha na importação.",
      },
      { status: 400 },
    );
  }
}
