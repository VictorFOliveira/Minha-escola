import { getSession } from "@/lib/session";
import { assertSchoolFeature } from "@/lib/features";
import {
  loadExportData,
  renderExport,
  type ExportFormat,
  type ExportType,
} from "@/lib/admin-exports";
import { auditUserAction } from "@/lib/audit";

const types: ExportType[] = [
  "STUDENTS",
  "GUARDIANS",
  "TEACHERS",
  "CLASSES",
  "ENROLLMENTS",
  "FINANCE",
  "ATTENDANCE",
  "GRADES",
];

const roleTypes: Record<string, ExportType[]> = {
  ADMIN: types,
  SECRETARY: [
    "STUDENTS",
    "GUARDIANS",
    "TEACHERS",
    "CLASSES",
    "ENROLLMENTS",
  ],
  COORDINATOR: [
    "STUDENTS",
    "TEACHERS",
    "CLASSES",
    "ENROLLMENTS",
    "ATTENDANCE",
    "GRADES",
  ],
  FINANCE: ["FINANCE"],
};

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) return new Response("Não autenticado.", { status: 401 });

  try {
    await assertSchoolFeature(session.schoolId, "advancedExports");
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Recurso indisponível.",
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const type = String(url.searchParams.get("type") || "") as ExportType;
  const format = String(
    url.searchParams.get("format") || "xlsx",
  ) as ExportFormat;

  if (
    !types.includes(type) ||
    !["csv", "xlsx", "pdf"].includes(format) ||
    !(roleTypes[session.role] || []).includes(type)
  ) {
    return new Response("Exportação não permitida.", { status: 403 });
  }

  const data = await loadExportData(session.schoolId, type);
  const rendered = await renderExport(data, format);

  await auditUserAction({
    schoolId: session.schoolId,
    userId: session.id,
    action: "ADMIN_EXPORT",
    entityType: type,
    metadata: {
      format,
      rows: data.rows.length,
    },
  }).catch(() => null);

  return new Response(rendered.body, {
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition":
        'attachment; filename="' +
        type.toLowerCase() +
        "-" +
        new Date().toISOString().slice(0, 10) +
        "." +
        rendered.extension +
        '"',
      "Cache-Control": "private, no-store",
    },
  });
}
