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
  let enrollment;
  try {
    enrollment = await prisma.$transaction(async (tx) => {
      // Matrícula possui duas invariantes concorrentes:
      // 1) capacidade da turma;
      // 2) uma matrícula ativa/pendente por aluno no mesmo ano.
      // Advisory locks mantêm essas verificações serializadas mesmo quando
      // chegam requests diferentes no mesmo milissegundo.
      await tx.$queryRaw`
        WITH advisory_lock AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${"enrollment-class:" + session.schoolId + ":" + classId}, 0)
          )
        )
        SELECT 1::int AS "locked" FROM advisory_lock
      `;
      await tx.$queryRaw`
        WITH advisory_lock AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${"enrollment-student-year:" + session.schoolId + ":" + studentId + ":" + classGroup.schoolYear}, 0)
          )
        )
        SELECT 1::int AS "locked" FROM advisory_lock
      `;

      const [currentOccupancy, duplicateInside, sameYearInside] =
        await Promise.all([
          tx.enrollment.count({
            where: {
              classId,
              status: { in: ["ACTIVE", "PENDING"] },
            },
          }),
          tx.enrollment.findUnique({
            where: { studentId_classId: { studentId, classId } },
          }),
          tx.enrollment.findFirst({
            where: {
              studentId,
              status: { in: ["ACTIVE", "PENDING"] },
              class: {
                schoolId: session.schoolId,
                schoolYear: classGroup.schoolYear,
              },
            },
            include: { class: true },
          }),
        ]);

      if (
        classGroup.capacity &&
        currentOccupancy >= classGroup.capacity
      ) {
        throw new Error("ENROLLMENT_CLASS_FULL");
      }

      if (duplicateInside) {
        throw new Error("ENROLLMENT_DUPLICATE");
      }

      if (sameYearInside) {
        throw new Error("ENROLLMENT_SAME_YEAR");
      }

      return tx.enrollment.create({
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
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ENROLLMENT_CLASS_FULL") {
        return NextResponse.json(
          { error: "A turma atingiu a capacidade cadastrada." },
          { status: 409 },
        );
      }
      if (error.message === "ENROLLMENT_DUPLICATE") {
        return NextResponse.json(
          { error: "O aluno já possui histórico nesta turma." },
          { status: 409 },
        );
      }
      if (error.message === "ENROLLMENT_SAME_YEAR") {
        return NextResponse.json(
          {
            error:
              "O aluno já possui matrícula ativa ou pendente neste ano letivo.",
          },
          { status: 409 },
        );
      }
    }

    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "A matrícula já foi criada por outra requisição." },
        { status: 409 },
      );
    }
    throw error;
  }

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
