import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  idempotencyHash,
  readIdempotency,
  saveIdempotency,
} from "@/lib/idempotency";
import { emitSchoolEvent } from "@/lib/outgoing-webhooks";
import { paginationFromRequest, paginationMeta } from "@/lib/pagination";

const readRoles = ["ADMIN", "COORDINATOR", "SECRETARY", "TEACHER"];
const writeRoles = ["ADMIN", "SECRETARY"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!readRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const url = new URL(request.url);
  const schoolYearParam = url.searchParams.get("schoolYear");
  const schoolYear = schoolYearParam ? Number(schoolYearParam) : null;
  const pagination = paginationFromRequest(request, {
    defaultPageSize: 50,
    maxPageSize: 100,
    maxAll: 5000,
  });

  const where = {
    class: {
      schoolId: session.schoolId,
      ...(Number.isInteger(schoolYear) ? { schoolYear: schoolYear as number } : {}),
      ...(session.role === "TEACHER" && session.teacherId
        ? {
            classSubjects: {
              some: { teacherId: session.teacherId },
            },
          }
        : {}),
    },
    ...(pagination.search
      ? {
          OR: [
            { student: { name: { contains: pagination.search, mode: "insensitive" as const } } },
            { student: { registration: { contains: pagination.search, mode: "insensitive" as const } } },
            { class: { name: { contains: pagination.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      orderBy: [{ class: { schoolYear: "desc" } }, { startedAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      include: {
        student: true,
        class: { include: { teacher: true } },
        previousEnrollment: {
          include: { class: true },
        },
        nextEnrollment: {
          include: { class: true },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return NextResponse.json({
    enrollments,
    meta: paginationMeta(total, pagination.page, pagination.pageSize),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!writeRoles.includes(session.role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const operation = "enrollment.create";
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

  const keyHash = idempotencyHash(
    request,
    session.schoolId,
    operation,
  );

  const body = await request.json().catch(() => null);
  const studentId = typeof body?.studentId === "string" ? body.studentId : "";
  const classId = typeof body?.classId === "string" ? body.classId : "";
  const startedAt = body?.startedAt ? new Date(body.startedAt) : new Date();

  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json(
      { error: "Data de início da matrícula inválida." },
      { status: 400 },
    );
  }

  const [student, classGroup] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId: session.schoolId, status: "ACTIVE" },
      include: {
        guardians: {
          include: { guardian: true },
        },
      },
    }),
    prisma.classGroup.findFirst({
      where: { id: classId, schoolId: session.schoolId },
      include: { _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "PENDING"] } } } } } },
    }),
  ]);

  if (!student || !classGroup) {
    return NextResponse.json({ error: "Aluno ou turma inválido." }, { status: 404 });
  }

  const activeGuardians = student.guardians.filter(
    (link) => link.guardian.status === "ACTIVE",
  );

  if (!activeGuardians.length) {
    return NextResponse.json(
      { error: "Todo aluno precisa ter pelo menos um responsável ativo antes da matrícula." },
      { status: 409 },
    );
  }

  if (!activeGuardians.some((link) => link.financialResponsible)) {
    return NextResponse.json(
      { error: "Defina um responsável financeiro para o aluno antes da matrícula." },
      { status: 409 },
    );
  }

  if (classGroup.capacity && classGroup._count.enrollments >= classGroup.capacity) {
    return NextResponse.json({ error: "A turma atingiu a capacidade cadastrada." }, { status: 409 });
  }

  const duplicate = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
  });
  if (duplicate) {
    return NextResponse.json({ error: "O aluno já possui histórico nesta turma." }, { status: 409 });
  }

  const sameYear = await prisma.enrollment.findFirst({
    where: {
      studentId,
      status: { in: ["ACTIVE", "PENDING"] },
      class: {
        schoolId: session.schoolId,
        schoolYear: classGroup.schoolYear,
      },
    },
    include: { class: true },
  });

  if (sameYear) {
    return NextResponse.json(
      { error: "O aluno já possui matrícula ativa ou pendente em " + sameYear.class.name + " no ano " + classGroup.schoolYear + "." },
      { status: 409 },
    );
  }

  const status = body?.status === "PENDING" ? "PENDING" : "ACTIVE";
  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      classId,
      type: "NEW",
      status,
      notes: body?.notes?.trim() || null,
      startedAt,
    },
    include: { student: true, class: true },
  });

  const responseBody = { enrollment };

  await Promise.all([
    saveIdempotency({
      schoolId: session.schoolId,
      operation,
      keyHash,
      responseStatus: 201,
      responseBody,
      resourceId: enrollment.id,
    }).catch(() => null),
    emitSchoolEvent({
      schoolId: session.schoolId,
      eventType: "enrollment.created",
      payload: {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        classId: enrollment.classId,
        status: enrollment.status,
      },
    }).catch(() => null),
  ]);

  return NextResponse.json(responseBody, { status: 201 });
}
