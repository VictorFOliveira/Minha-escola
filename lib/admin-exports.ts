import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export type ExportType =
  | "STUDENTS"
  | "GUARDIANS"
  | "TEACHERS"
  | "CLASSES"
  | "ENROLLMENTS"
  | "FINANCE"
  | "ATTENDANCE"
  | "GRADES";

export type ExportFormat = "csv" | "xlsx" | "pdf";

type ExportData = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
};

function date(value: Date | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR").format(value)
    : "";
}

function decimal(value: unknown) {
  return value === null || value === undefined ? "" : Number(value);
}

export async function loadExportData(
  schoolId: string,
  type: ExportType,
): Promise<ExportData> {
  if (type === "STUDENTS") {
    const items = await prisma.student.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      take: 20000,
    });

    return {
      title: "Alunos",
      columns: [
        "Matrícula",
        "Nome",
        "Nascimento",
        "Documento",
        "Telefone",
        "E-mail",
        "Status",
      ],
      rows: items.map((item) => [
        item.registration,
        item.name,
        date(item.birthDate),
        item.document || "",
        item.phone || "",
        item.email || "",
        item.status,
      ]),
    };
  }

  if (type === "GUARDIANS") {
    const items = await prisma.guardian.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      include: {
        students: {
          include: {
            student: {
              select: { name: true, registration: true },
            },
          },
        },
      },
      take: 20000,
    });

    return {
      title: "Responsáveis",
      columns: [
        "Nome",
        "Documento",
        "Telefone",
        "E-mail",
        "Alunos vinculados",
        "Responsável financeiro de",
        "Status",
      ],
      rows: items.map((item) => [
        item.name,
        item.document || "",
        item.phone,
        item.email || "",
        item.students
          .map(
            (link) =>
              link.student.name + " (" + link.student.registration + ")",
          )
          .join("; "),
        item.students
          .filter((link) => link.financialResponsible)
          .map((link) => link.student.name)
          .join("; "),
        item.status,
      ]),
    };
  }

  if (type === "TEACHERS") {
    const items = await prisma.teacher.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      take: 20000,
    });

    return {
      title: "Professores",
      columns: [
        "Nome",
        "Documento",
        "E-mail",
        "Telefone",
        "Especialidade",
        "Status",
      ],
      rows: items.map((item) => [
        item.name,
        item.document || "",
        item.email || "",
        item.phone || "",
        item.specialty || "",
        item.status,
      ]),
    };
  }

  if (type === "CLASSES") {
    const items = await prisma.classGroup.findMany({
      where: { schoolId },
      orderBy: [{ schoolYear: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { enrollments: true } },
      },
      take: 20000,
    });

    return {
      title: "Turmas",
      columns: [
        "Ano",
        "Turma",
        "Série",
        "Turno",
        "Sala",
        "Capacidade",
        "Matrículas",
      ],
      rows: items.map((item) => [
        item.schoolYear,
        item.name,
        item.gradeLevel,
        item.shift,
        item.room || "",
        item.capacity ?? "",
        item._count.enrollments,
      ]),
    };
  }

  if (type === "ENROLLMENTS") {
    const items = await prisma.enrollment.findMany({
      where: { class: { schoolId } },
      orderBy: [{ class: { schoolYear: "desc" } }, { student: { name: "asc" } }],
      include: {
        student: true,
        class: true,
      },
      take: 20000,
    });

    return {
      title: "Matrículas",
      columns: [
        "Ano",
        "Matrícula",
        "Aluno",
        "Turma",
        "Série",
        "Tipo",
        "Status",
        "Início",
        "Fim",
      ],
      rows: items.map((item) => [
        item.class.schoolYear,
        item.student.registration,
        item.student.name,
        item.class.name,
        item.class.gradeLevel,
        item.type,
        item.status,
        date(item.startedAt),
        date(item.endedAt),
      ]),
    };
  }

  if (type === "FINANCE") {
    const items = await prisma.charge.findMany({
      where: { schoolId },
      orderBy: [{ dueDate: "desc" }, { student: { name: "asc" } }],
      include: {
        student: true,
        guardian: true,
      },
      take: 20000,
    });

    return {
      title: "Financeiro",
      columns: [
        "Aluno",
        "Matrícula",
        "Responsável",
        "Descrição",
        "Parcela",
        "Vencimento",
        "Valor",
        "Pago",
        "Status",
        "Data pagamento",
      ],
      rows: items.map((item) => [
        item.student.name,
        item.student.registration,
        item.guardian?.name || "",
        item.description,
        item.installmentNumber,
        date(item.dueDate),
        decimal(item.amount),
        decimal(item.paidAmount),
        item.status,
        date(item.paidAt),
      ]),
    };
  }

  if (type === "ATTENDANCE") {
    const items = await prisma.lessonAttendance.findMany({
      where: {
        lesson: {
          classSubject: {
            class: { schoolId },
          },
        },
      },
      orderBy: { lesson: { lessonDate: "desc" } },
      include: {
        enrollment: { include: { student: true } },
        lesson: {
          include: {
            classSubject: {
              include: {
                subject: true,
                class: true,
              },
            },
          },
        },
      },
      take: 20000,
    });

    return {
      title: "Frequência",
      columns: [
        "Data",
        "Aluno",
        "Matrícula",
        "Turma",
        "Disciplina",
        "Presença",
        "Observação",
      ],
      rows: items.map((item) => [
        date(item.lesson.lessonDate),
        item.enrollment.student.name,
        item.enrollment.student.registration,
        item.lesson.classSubject.class.name,
        item.lesson.classSubject.subject.name,
        item.status,
        item.note || "",
      ]),
    };
  }

  const items = await prisma.periodGrade.findMany({
    where: {
      enrollment: {
        class: { schoolId },
      },
    },
    orderBy: [
      { enrollment: { student: { name: "asc" } } },
      { period: { order: "asc" } },
    ],
    include: {
      enrollment: {
        include: { student: true, class: true },
      },
      classSubject: {
        include: { subject: true },
      },
      period: true,
    },
    take: 20000,
  });

  return {
    title: "Notas",
    columns: [
      "Aluno",
      "Matrícula",
      "Turma",
      "Disciplina",
      "Período",
      "Média",
      "Status",
    ],
    rows: items.map((item) => [
      item.enrollment.student.name,
      item.enrollment.student.registration,
      item.enrollment.class.name,
      item.classSubject.subject.name,
      item.period.name,
      decimal(item.average),
      item.status,
    ]),
  };
}

function csvEscape(value: string | number | null) {
  const text = String(value ?? "");
  return '"' + text.replaceAll('"', '""') + '"';
}

export async function renderExport(
  data: ExportData,
  format: ExportFormat,
) {
  if (format === "csv") {
    const body =
      "\uFEFF" +
      [data.columns, ...data.rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");

    return {
      body: Buffer.from(body, "utf8"),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(data.title.slice(0, 31));
    sheet.addRow(data.columns);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const row of data.rows) sheet.addRow(row);

    sheet.columns.forEach((column) => {
      let width = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.min(
          45,
          Math.max(width, String(cell.value ?? "").length + 2),
        );
      });
      column.width = width;
    });

    return {
      body: Buffer.from(await workbook.xlsx.writeBuffer()),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 842;
  const height = 595;
  const margin = 32;
  const lineHeight = 12;

  let page = pdf.addPage([width, height]);
  let y = height - margin;

  function nextPage() {
    page = pdf.addPage([width, height]);
    y = height - margin;
  }

  page.drawText(data.title, {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: rgb(0.08, 0.14, 0.25),
  });
  y -= 24;

  const columnWidth = (width - margin * 2) / data.columns.length;
  data.columns.forEach((column, index) => {
    page.drawText(column.slice(0, 22), {
      x: margin + index * columnWidth,
      y,
      size: 7,
      font: bold,
    });
  });
  y -= lineHeight;

  for (const row of data.rows) {
    if (y < margin + 10) {
      nextPage();
      data.columns.forEach((column, index) => {
        page.drawText(column.slice(0, 22), {
          x: margin + index * columnWidth,
          y,
          size: 7,
          font: bold,
        });
      });
      y -= lineHeight;
    }

    row.forEach((value, index) => {
      page.drawText(String(value ?? "").slice(0, 28), {
        x: margin + index * columnWidth,
        y,
        size: 6.5,
        font,
      });
    });
    y -= lineHeight;
  }

  return {
    body: Buffer.from(await pdf.save()),
    contentType: "application/pdf",
    extension: "pdf",
  };
}
