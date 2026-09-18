import { prisma } from "@/lib/prisma";
import {
  calculateAnnualAverage,
  calculateAttendancePercent,
  calculateRecoveryFinal,
  determineSubjectStatus,
} from "@/lib/grade-calculations";

export async function getAcademicPolicy(schoolId: string, schoolYear: number) {
  const policy = await prisma.academicPolicy.findUnique({
    where: {
      schoolId_schoolYear: {
        schoolId,
        schoolYear,
      },
    },
  });

  return policy
    ? {
        id: policy.id,
        schoolId,
        schoolYear,
        passingAverage: Number(policy.passingAverage),
        minimumAttendance: Number(policy.minimumAttendance),
        recoveryEnabled: policy.recoveryEnabled,
        recoveryMode: policy.recoveryMode,
      }
    : {
        id: null,
        schoolId,
        schoolYear,
        passingAverage: 6,
        minimumAttendance: 75,
        recoveryEnabled: true,
        recoveryMode: "REPLACE_IF_HIGHER" as const,
      };
}

export async function buildSubjectResult(input: {
  schoolId: string;
  enrollmentId: string;
  classSubjectId: string;
  recoveryScore?: number | null;
  manualFinalAverage?: number | null;
}) {
  const { schoolId, enrollmentId, classSubjectId } = input;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      class: { schoolId },
    },
    include: { class: true },
  });

  if (!enrollment) return null;

  const classSubject = await prisma.classSubject.findFirst({
    where: {
      id: classSubjectId,
      classId: enrollment.classId,
      class: { schoolId },
    },
    include: { subject: true },
  });

  if (!classSubject) return null;

  const [policy, periods, periodGrades, attendance, existing] =
    await Promise.all([
      getAcademicPolicy(schoolId, enrollment.class.schoolYear),
      prisma.academicPeriod.findMany({
        where: {
          schoolId,
          schoolYear: enrollment.class.schoolYear,
        },
        orderBy: { order: "asc" },
      }),
      prisma.periodGrade.findMany({
        where: {
          enrollmentId,
          classSubjectId,
          status: "CLOSED",
        },
        include: { period: true },
      }),
      prisma.lessonAttendance.findMany({
        where: {
          enrollmentId,
          lesson: {
            classSubjectId,
            status: "COMPLETED",
          },
        },
        select: { status: true },
      }),
      prisma.subjectFinalResult.findUnique({
        where: {
          enrollmentId_classSubjectId: {
            enrollmentId,
            classSubjectId,
          },
        },
      }),
    ]);

  const gradeByPeriod = new Map(
    periodGrades.map((grade) => [grade.periodId, grade]),
  );

  const allPeriodsClosed =
    periods.length > 0 &&
    periods.every((period) => {
      const grade = gradeByPeriod.get(period.id);
      return grade?.status === "CLOSED" && grade.average !== null;
    });

  const annualAverage = calculateAnnualAverage(
    periods
      .map((period) => {
        const grade = gradeByPeriod.get(period.id);
        if (!grade || grade.average === null) return null;

        return {
          average: Number(grade.average),
          weight: Number(period.weight),
        };
      })
      .filter(
        (item): item is { average: number; weight: number } => item !== null,
      ),
  );

  const counts = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };

  for (const item of attendance) {
    if (item.status === "PRESENT") counts.present += 1;
    if (item.status === "LATE") counts.late += 1;
    if (item.status === "ABSENT") counts.absent += 1;
    if (item.status === "EXCUSED") counts.excused += 1;
  }

  const attendancePercent = calculateAttendancePercent(counts);
  const recoveryScore =
    input.recoveryScore !== undefined
      ? input.recoveryScore
      : existing?.recoveryScore === null || existing?.recoveryScore === undefined
        ? null
        : Number(existing.recoveryScore);

  const manualFinalAverage =
    input.manualFinalAverage !== undefined
      ? input.manualFinalAverage
      : existing?.finalAverage === null || existing?.finalAverage === undefined
        ? null
        : Number(existing.finalAverage);

  const finalAverage =
    annualAverage === null
      ? null
      : calculateRecoveryFinal({
          annualAverage,
          recoveryScore,
          recoveryMode: policy.recoveryMode,
          manualFinalAverage,
        });

  const status = !allPeriodsClosed
    ? ("IN_PROGRESS" as const)
    : determineSubjectStatus({
        annualAverage,
        finalAverage,
        attendancePercent,
        passingAverage: policy.passingAverage,
        minimumAttendance: policy.minimumAttendance,
        recoveryEnabled: policy.recoveryEnabled,
        hasRecoveryScore: recoveryScore !== null,
      });

  return {
    enrollment,
    classSubject,
    policy,
    periods,
    periodGrades,
    annualAverage,
    recoveryScore,
    finalAverage,
    attendancePercent,
    status,
    allPeriodsClosed,
  };
}

export async function recomputeEnrollmentStatus(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      class: {
        include: {
          classSubjects: {
            select: { id: true },
          },
        },
      },
      subjectResults: true,
    },
  });

  if (!enrollment) return null;

  const resultBySubject = new Map(
    enrollment.subjectResults.map((item) => [item.classSubjectId, item]),
  );

  const statuses = enrollment.class.classSubjects.map(
    (subject) => resultBySubject.get(subject.id)?.status || "IN_PROGRESS",
  );

  let status: "IN_PROGRESS" | "APPROVED" | "FAILED" = "IN_PROGRESS";

  if (
    statuses.length > 0 &&
    statuses.every((item) => item === "APPROVED")
  ) {
    status = "APPROVED";
  } else if (
    statuses.some(
      (item) =>
        item === "FAILED_GRADE" || item === "FAILED_ATTENDANCE",
    ) &&
    !statuses.some(
      (item) => item === "IN_PROGRESS" || item === "RECOVERY",
    )
  ) {
    status = "FAILED";
  }

  return { enrollment, status, statuses };
}
