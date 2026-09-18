import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";
import {
  idempotencyHash,
  readIdempotency,
  saveIdempotency,
} from "@/lib/idempotency";

const readRoles = ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "SECRETARY"];

function parseYear(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function parseCapacity(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const capacity = Number(value);
  return Number.isInteger(capacity) && capacity > 0 ? capacity : null;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const pagination = paginationFromRequest(request, {
    defaultPageSize: 100,
    maxPageSize: 250,
    maxAll: 5000,
  });
  const url = new URL(request.url);
  const requestedYear = Number(url.searchParams.get("schoolYear") || 0);

  const where = {
    schoolId: session.schoolId,
    ...(Number.isInteger(requestedYear) && requestedYear > 0
      ? { schoolYear: requestedYear }
      : {}),
    ...(pagination.search
      ? {
          OR: [
            { name: { contains: pagination.search, mode: "insensitive" as const } },
            { gradeLevel: { contains: pagination.search, mode: "insensitive" as const } },
            { room: { contains: pagination.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(session.role === "TEACHER" && session.teacherId
      ? {
          AND: [
            {
              OR: [
                { teacherId: session.teacherId },
                { classSubjects: { some: { teacherId: session.teacherId } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [classes, total] = await Promise.all([
    prisma.classGroup.findMany({
      where,
      orderBy: [{ schoolYear: "desc" }, { gradeLevel: "asc" }, { name: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        teacher: true,
        curriculum: true,
        _count: {
          select: {
            enrollments: {
              where: { status: { in: ["ACTIVE", "PENDING"] } },
            },
          },
        },
      },
    }),
    prisma.classGroup.count({ where }),
  ]);

  return NextResponse.json({
    classes,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const operation = "class.create";
  const previous = await readIdempotency(
    request,
    session.schoolId,
    operation,
  ).catch(() => null);

  if (previous?.responseBody && previous.responseStatus) {
    return NextResponse.json(previous.responseBody, {
      status: previous.responseStatus,
      headers: { "Idempotent-Replay": "true" },
    });
  }

  const keyHash = idempotencyHash(request, session.schoolId, operation);
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const gradeLevel = typeof body?.gradeLevel === "string" ? body.gradeLevel.trim() : "";
  const shift = typeof body?.shift === "string" ? body.shift.trim() : "";
  const schoolYear = parseYear(body?.schoolYear);
  const capacity = parseCapacity(body?.capacity);

  if (!name || !gradeLevel || !shift || !schoolYear) {
    return NextResponse.json(
      { error: "Nome, série/etapa, turno e ano letivo são obrigatórios." },
      { status: 400 },
    );
  }

  let teacherId: string | null = null;
  if (body?.teacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: String(body.teacherId),
        schoolId: session.schoolId,
        status: "ACTIVE",
      },
    });
    if (!teacher) {
      return NextResponse.json({ error: "Professor inválido para esta escola." }, { status: 400 });
    }
    teacherId = teacher.id;
  }

  const classGroup = await prisma.classGroup.create({
    data: {
      schoolId: session.schoolId,
      name,
      gradeLevel,
      shift,
      room: body?.room?.trim() || null,
      schoolYear,
      capacity,
      teacherId,
    },
    include: { teacher: true, _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "PENDING"] } } } } } },
  });

  const responseBody = { class: classGroup };

  await saveIdempotency({
    schoolId: session.schoolId,
    operation,
    keyHash,
    responseStatus: 201,
    responseBody,
    resourceId: classGroup.id,
  }).catch(() => null);

  return NextResponse.json(responseBody, { status: 201 });
}
