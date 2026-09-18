import ExcelJS from "exceljs";
import { getSession } from "@/lib/session";
import { assertSchoolFeature } from "@/lib/features";
import {
  importHeaders,
  type ImportType,
} from "@/lib/imports";

const allowedTypes: ImportType[] = [
  "STUDENTS",
  "GUARDIANS",
  "TEACHERS",
  "CLASSES",
  "ENROLLMENTS",
];

function csvEscape(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) return new Response("Não autenticado.", { status: 401 });
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return new Response("Acesso negado.", { status: 403 });
  }

  try {
    await assertSchoolFeature(session.schoolId, "bulkImport");
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Recurso indisponível.",
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const type = String(url.searchParams.get("type") || "") as ImportType;
  const format =
    url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  if (!allowedTypes.includes(type)) {
    return new Response("Tipo inválido.", { status: 400 });
  }

  const columns = importHeaders(type);

  if (format === "csv") {
    const body = columns.map(csvEscape).join(",") + "\n";
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="template-' + type.toLowerCase() + '.csv"',
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Importação");
  sheet.addRow(columns);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns = columns.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 4),
  }));

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="template-' + type.toLowerCase() + '.xlsx"',
    },
  });
}
