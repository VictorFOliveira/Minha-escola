import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { assertStudentLimit } from "@/lib/tenant-limits";

export type ImportType =
  | "STUDENTS"
  | "GUARDIANS"
  | "TEACHERS"
  | "CLASSES"
  | "ENROLLMENTS";

type Row = Record<string, string>;

const headers: Record<ImportType, string[]> = {
  STUDENTS: [
    "registration",
    "name",
    "birthDate",
    "document",
    "phone",
    "email",
    "address",
    "status",
  ],
  GUARDIANS: [
    "name",
    "document",
    "phone",
    "email",
    "address",
    "studentRegistration",
    "relationship",
    "financialResponsible",
    "authorizedPickup",
  ],
  TEACHERS: [
    "name",
    "document",
    "email",
    "phone",
    "specialty",
    "status",
  ],
  CLASSES: [
    "name",
    "gradeLevel",
    "shift",
    "room",
    "capacity",
    "schoolYear",
  ],
  ENROLLMENTS: [
    "studentRegistration",
    "className",
    "schoolYear",
    "type",
    "status",
    "notes",
  ],
};

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function canonicalHeader(type: ImportType, value: unknown) {
  const normalized = normalizedHeader(value);
  return (
    headers[type].find(
      (item) => normalizedHeader(item) === normalized,
    ) || String(value ?? "").trim()
  );
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
    if ("result" in value) return String(value.result ?? "").trim();
  }
  return String(value).trim();
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export async function parseImportFile(input: {
  type: ImportType;
  name: string;
  buffer: Buffer;
}) {
  const lower = input.name.toLowerCase();

  if (lower.endsWith(".csv")) {
    const matrix = parseCsv(input.buffer.toString("utf8"));
    if (!matrix.length) return [];

    const headerRow = matrix[0].map((item) =>
      canonicalHeader(input.type, item),
    );

    return matrix.slice(1).map((values) =>
      headerRow.reduce((record, header, index) => {
        record[header] = String(values[index] ?? "").trim();
        return record;
      }, {} as Row),
    );
  }

  if (!lower.endsWith(".xlsx")) {
    throw new Error("Envie arquivo .csv ou .xlsx.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) return [];

  const headerRow = worksheet
    .getRow(1)
    .values as ExcelJS.CellValue[];

  const normalizedHeaders = headerRow
    .slice(1)
    .map((item) => canonicalHeader(input.type, item));

  const rows: Row[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values = row.values as ExcelJS.CellValue[];
    const record: Row = {};

    normalizedHeaders.forEach((header, index) => {
      record[header] = cellText(values[index + 1]);
    });

    if (Object.values(record).some(Boolean)) rows.push(record);
  });

  return rows;
}

function booleanValue(value: string, fallback = false) {
  if (!value) return fallback;
  return ["1", "true", "sim", "yes", "s"].includes(
    value.trim().toLowerCase(),
  );
}

function dateValue(value: string) {
  if (!value) return null;
  const parsed = new Date(value + (value.length === 10 ? "T12:00:00.000Z" : ""));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data inválida: " + value);
  }
  return parsed;
}

function integerValue(value: string, fallback?: number) {
  if (!value && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error("Número inteiro inválido: " + value);
  }
  return parsed;
}

export async function processImportRows(input: {
  schoolId: string;
  type: ImportType;
  rows: Row[];
}) {
  const errors: Array<{ row: number; message: string }> = [];
  let successRows = 0;

  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index];
    const rowNumber = index + 2;

    try {
      if (input.type === "STUDENTS") {
        const registration = row.registration?.trim();
        const name = row.name?.trim();

        if (!registration || !name) {
          throw new Error("registration e name são obrigatórios.");
        }

        const existing = await prisma.student.findUnique({
          where: {
            schoolId_registration: {
              schoolId: input.schoolId,
              registration,
            },
          },
        });

        if (!existing) {
          await assertStudentLimit(input.schoolId);
        }

        await prisma.student.upsert({
          where: {
            schoolId_registration: {
              schoolId: input.schoolId,
              registration,
            },
          },
          update: {
            name,
            birthDate: dateValue(row.birthDate),
            document: row.document || null,
            phone: row.phone || null,
            email: row.email?.toLowerCase() || null,
            address: row.address || null,
            status: row.status?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          },
          create: {
            schoolId: input.schoolId,
            registration,
            name,
            birthDate: dateValue(row.birthDate),
            document: row.document || null,
            phone: row.phone || null,
            email: row.email?.toLowerCase() || null,
            address: row.address || null,
            status: row.status?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
          },
        });
      }

      if (input.type === "GUARDIANS") {
        const name = row.name?.trim();
        const phone = row.phone?.trim();

        if (!name || !phone) {
          throw new Error("name e phone são obrigatórios.");
        }

        let guardian = await prisma.guardian.findFirst({
          where: {
            schoolId: input.schoolId,
            OR: [
              ...(row.document ? [{ document: row.document }] : []),
              { phone },
              ...(row.email
                ? [{ email: row.email.toLowerCase() }]
                : []),
            ],
          },
        });

        if (guardian) {
          guardian = await prisma.guardian.update({
            where: { id: guardian.id },
            data: {
              name,
              document: row.document || guardian.document,
              phone,
              email: row.email?.toLowerCase() || guardian.email,
              address: row.address || guardian.address,
              status: "ACTIVE",
            },
          });
        } else {
          guardian = await prisma.guardian.create({
            data: {
              schoolId: input.schoolId,
              name,
              document: row.document || null,
              phone,
              email: row.email?.toLowerCase() || null,
              address: row.address || null,
            },
          });
        }

        if (row.studentRegistration) {
          const student = await prisma.student.findUnique({
            where: {
              schoolId_registration: {
                schoolId: input.schoolId,
                registration: row.studentRegistration,
              },
            },
          });

          if (!student) {
            throw new Error(
              "Aluno não encontrado: " + row.studentRegistration,
            );
          }

          const financialResponsible = booleanValue(
            row.financialResponsible,
          );

          await prisma.$transaction(async (tx) => {
            if (financialResponsible) {
              await tx.studentGuardian.updateMany({
                where: { studentId: student.id },
                data: { financialResponsible: false },
              });
            }

            await tx.studentGuardian.upsert({
              where: {
                studentId_guardianId: {
                  studentId: student.id,
                  guardianId: guardian!.id,
                },
              },
              update: {
                relationship: row.relationship || "Responsável",
                financialResponsible,
                authorizedPickup: booleanValue(
                  row.authorizedPickup,
                  true,
                ),
              },
              create: {
                studentId: student.id,
                guardianId: guardian!.id,
                relationship: row.relationship || "Responsável",
                financialResponsible,
                authorizedPickup: booleanValue(
                  row.authorizedPickup,
                  true,
                ),
              },
            });
          });
        }
      }

      if (input.type === "TEACHERS") {
        const name = row.name?.trim();
        if (!name) throw new Error("name é obrigatório.");

        const teacher = await prisma.teacher.findFirst({
          where: {
            schoolId: input.schoolId,
            OR: [
              ...(row.document ? [{ document: row.document }] : []),
              ...(row.email
                ? [{ email: row.email.toLowerCase() }]
                : []),
              { name },
            ],
          },
        });

        if (teacher) {
          await prisma.teacher.update({
            where: { id: teacher.id },
            data: {
              name,
              document: row.document || teacher.document,
              email: row.email?.toLowerCase() || teacher.email,
              phone: row.phone || teacher.phone,
              specialty: row.specialty || teacher.specialty,
              status: row.status?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            },
          });
        } else {
          await prisma.teacher.create({
            data: {
              schoolId: input.schoolId,
              name,
              document: row.document || null,
              email: row.email?.toLowerCase() || null,
              phone: row.phone || null,
              specialty: row.specialty || null,
              status: row.status?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            },
          });
        }
      }

      if (input.type === "CLASSES") {
        const name = row.name?.trim();
        const gradeLevel = row.gradeLevel?.trim();
        const shift = row.shift?.trim();
        const schoolYear = integerValue(row.schoolYear);

        if (!name || !gradeLevel || !shift) {
          throw new Error(
            "name, gradeLevel, shift e schoolYear são obrigatórios.",
          );
        }

        const existing = await prisma.classGroup.findFirst({
          where: {
            schoolId: input.schoolId,
            name,
            schoolYear,
          },
        });

        const data = {
          name,
          gradeLevel,
          shift,
          room: row.room || null,
          capacity: row.capacity
            ? integerValue(row.capacity)
            : null,
          schoolYear,
        };

        if (existing) {
          await prisma.classGroup.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await prisma.classGroup.create({
            data: {
              schoolId: input.schoolId,
              ...data,
            },
          });
        }
      }

      if (input.type === "ENROLLMENTS") {
        const registration = row.studentRegistration?.trim();
        const className = row.className?.trim();
        const schoolYear = integerValue(row.schoolYear);

        if (!registration || !className) {
          throw new Error(
            "studentRegistration, className e schoolYear são obrigatórios.",
          );
        }

        const student = await prisma.student.findUnique({
          where: {
            schoolId_registration: {
              schoolId: input.schoolId,
              registration,
            },
          },
          include: {
            guardians: true,
          },
        });

        if (!student) {
          throw new Error("Aluno não encontrado: " + registration);
        }

        if (
          !student.guardians.length ||
          !student.guardians.some(
            (link) => link.financialResponsible,
          )
        ) {
          throw new Error(
            "Aluno precisa de responsável e responsável financeiro antes da matrícula.",
          );
        }

        const classGroup = await prisma.classGroup.findFirst({
          where: {
            schoolId: input.schoolId,
            name: className,
            schoolYear,
          },
        });

        if (!classGroup) {
          throw new Error(
            "Turma não encontrada: " +
              className +
              " / " +
              schoolYear,
          );
        }

        const type = ["NEW", "REENROLLMENT", "TRANSFER"].includes(
          row.type?.toUpperCase(),
        )
          ? (row.type.toUpperCase() as "NEW" | "REENROLLMENT" | "TRANSFER")
          : "NEW";
        const status = ["ACTIVE", "PENDING", "TRANSFERRED", "CANCELLED"].includes(
          row.status?.toUpperCase(),
        )
          ? (row.status.toUpperCase() as
              | "ACTIVE"
              | "PENDING"
              | "TRANSFERRED"
              | "CANCELLED")
          : "ACTIVE";

        await prisma.enrollment.upsert({
          where: {
            studentId_classId: {
              studentId: student.id,
              classId: classGroup.id,
            },
          },
          update: {
            type,
            status,
            notes: row.notes || null,
          },
          create: {
            studentId: student.id,
            classId: classGroup.id,
            type,
            status,
            notes: row.notes || null,
          },
        });
      }

      successRows += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message:
          error instanceof Error ? error.message : "Erro desconhecido.",
      });
    }
  }

  return {
    totalRows: input.rows.length,
    successRows,
    failedRows: errors.length,
    errors,
  };
}

export function importHeaders(type: ImportType) {
  return headers[type];
}
