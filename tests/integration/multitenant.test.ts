import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import {
  canTargetClass,
  resolveCommunicationRecipients,
} from "../../lib/communication";
import { canAccessSchoolDocument } from "../../lib/document-access";
import { assertStudentLimit } from "../../lib/tenant-limits";
import type { SessionUser } from "../../lib/session";

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  const suffix = randomUUID().slice(0, 8);

  const plan = await prisma.saaSPlan.create({
    data: {
      code: "TEST-" + suffix,
      name: "Plano teste " + suffix,
      monthlyPrice: 1,
      maxStudents: 1,
      maxUsers: 10,
    },
  });

  const schoolA = await prisma.school.create({
    data: {
      name: "Escola A " + suffix,
      slug: "escola-a-" + suffix,
      lifecycleStatus: "ACTIVE",
    },
  });

  const schoolB = await prisma.school.create({
    data: {
      name: "Escola B " + suffix,
      slug: "escola-b-" + suffix,
      lifecycleStatus: "ACTIVE",
    },
  });

  await prisma.schoolSubscription.createMany({
    data: [
      {
        schoolId: schoolA.id,
        planId: plan.id,
        status: "ACTIVE",
      },
      {
        schoolId: schoolB.id,
        planId: plan.id,
        status: "ACTIVE",
      },
    ],
  });

  const teacherA = await prisma.teacher.create({
    data: {
      schoolId: schoolA.id,
      name: "Professor A",
      status: "ACTIVE",
    },
  });

  const teacherB = await prisma.teacher.create({
    data: {
      schoolId: schoolB.id,
      name: "Professor B",
      status: "ACTIVE",
    },
  });

  const subjectA = await prisma.subject.create({
    data: {
      schoolId: schoolA.id,
      name: "Matemática " + suffix,
    },
  });

  const subjectB = await prisma.subject.create({
    data: {
      schoolId: schoolB.id,
      name: "Português " + suffix,
    },
  });

  const classA = await prisma.classGroup.create({
    data: {
      schoolId: schoolA.id,
      name: "1A",
      gradeLevel: "1º ano",
      shift: "Manhã",
      schoolYear: 2026,
    },
  });

  const classB = await prisma.classGroup.create({
    data: {
      schoolId: schoolB.id,
      name: "1B",
      gradeLevel: "1º ano",
      shift: "Manhã",
      schoolYear: 2026,
    },
  });

  await prisma.classSubject.createMany({
    data: [
      {
        classId: classA.id,
        subjectId: subjectA.id,
        teacherId: teacherA.id,
      },
      {
        classId: classB.id,
        subjectId: subjectB.id,
        teacherId: teacherB.id,
      },
    ],
  });

  const studentA = await prisma.student.create({
    data: {
      schoolId: schoolA.id,
      registration: "A-" + suffix,
      name: "Aluno A",
    },
  });

  const studentB = await prisma.student.create({
    data: {
      schoolId: schoolB.id,
      registration: "B-" + suffix,
      name: "Aluno B",
    },
  });

  const guardianA = await prisma.guardian.create({
    data: {
      schoolId: schoolA.id,
      name: "Responsável A",
      phone: "85999990001",
    },
  });

  const guardianB = await prisma.guardian.create({
    data: {
      schoolId: schoolB.id,
      name: "Responsável B",
      phone: "85999990002",
    },
  });

  await prisma.studentGuardian.createMany({
    data: [
      {
        studentId: studentA.id,
        guardianId: guardianA.id,
        relationship: "Responsável",
        financialResponsible: true,
      },
      {
        studentId: studentB.id,
        guardianId: guardianB.id,
        relationship: "Responsável",
        financialResponsible: true,
      },
    ],
  });

  const enrollmentA = await prisma.enrollment.create({
    data: {
      studentId: studentA.id,
      classId: classA.id,
      status: "ACTIVE",
    },
  });

  const enrollmentB = await prisma.enrollment.create({
    data: {
      studentId: studentB.id,
      classId: classB.id,
      status: "ACTIVE",
    },
  });

  return {
    plan,
    schoolA,
    schoolB,
    teacherA,
    teacherB,
    classA,
    classB,
    studentA,
    studentB,
    guardianA,
    guardianB,
    enrollmentA,
    enrollmentB,
  };
}

async function cleanup(fixture: Fixture) {
  await prisma.school.deleteMany({
    where: {
      id: { in: [fixture.schoolA.id, fixture.schoolB.id] },
    },
  });
  await prisma.saaSPlan.delete({ where: { id: fixture.plan.id } });
}

test("teacher and admin cannot target a class from another tenant", async () => {
  const fixture = await createFixture();

  try {
    const teacherSession: SessionUser = {
      id: "teacher-user",
      schoolId: fixture.schoolA.id,
      schoolName: fixture.schoolA.name,
      name: "Professor A",
      email: "teacher-a@example.invalid",
      role: "TEACHER",
      teacherId: fixture.teacherA.id,
    };

    const adminSession: SessionUser = {
      ...teacherSession,
      id: "admin-a",
      role: "ADMIN",
      teacherId: null,
    };

    assert.ok(await canTargetClass(teacherSession, fixture.classA.id));
    assert.equal(
      await canTargetClass(teacherSession, fixture.classB.id),
      null,
    );
    assert.equal(await canTargetClass(adminSession, fixture.classB.id), null);
  } finally {
    await cleanup(fixture);
  }
});

test("class communication resolves only recipients from the tenant class", async () => {
  const fixture = await createFixture();

  try {
    const teacherSession: SessionUser = {
      id: "teacher-user",
      schoolId: fixture.schoolA.id,
      schoolName: fixture.schoolA.name,
      name: "Professor A",
      email: "teacher-a@example.invalid",
      role: "TEACHER",
      teacherId: fixture.teacherA.id,
    };

    const recipients = await resolveCommunicationRecipients({
      session: teacherSession,
      audience: "CLASS_GUARDIANS",
      targetClassId: fixture.classA.id,
    });

    assert.deepEqual(
      recipients.map((item: { guardianId?: string | null }) => item.guardianId),
      [fixture.guardianA.id],
    );
    assert.equal(
      recipients.some((item: { guardianId?: string | null }) => item.guardianId === fixture.guardianB.id),
      false,
    );

    await assert.rejects(
      resolveCommunicationRecipients({
        session: teacherSession,
        audience: "CLASS_GUARDIANS",
        targetClassId: fixture.classB.id,
      }),
      /sem acesso/i,
    );
  } finally {
    await cleanup(fixture);
  }
});

test("document access rejects cross-tenant documents before any subject lookup", async () => {
  const fixture = await createFixture();

  try {
    const studentSession: SessionUser = {
      id: "student-user",
      schoolId: fixture.schoolA.id,
      schoolName: fixture.schoolA.name,
      name: "Aluno A",
      email: "student-a@example.invalid",
      role: "STUDENT",
      enrollmentId: fixture.enrollmentA.id,
    };

    const allowed = await canAccessSchoolDocument(studentSession, {
      id: "document-b",
      schoolId: fixture.schoolB.id,
      type: "REPORT_CARD",
      studentId: fixture.studentB.id,
      enrollmentId: fixture.enrollmentB.id,
      guardianId: fixture.guardianB.id,
    });

    assert.equal(allowed, false);
  } finally {
    await cleanup(fixture);
  }
});

test("student limits are scoped per school subscription", async () => {
  const fixture = await createFixture();

  try {
    await assert.rejects(
      assertStudentLimit(fixture.schoolA.id),
      /limite de alunos/i,
    );

    await prisma.student.update({
      where: { id: fixture.studentA.id },
      data: { status: "INACTIVE" },
    });

    await assert.doesNotReject(assertStudentLimit(fixture.schoolA.id));
  } finally {
    await cleanup(fixture);
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
