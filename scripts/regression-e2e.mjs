import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const password = "Regression-2026!Secure";

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Sessão não retornou cookie.");
  return raw.split(";")[0];
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data };
}

async function login(email) {
  const result = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "X-Forwarded-For": "127.0.0.77" },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data?.mfaRequired, undefined);
  return cookieFrom(result.response);
}

async function authed(cookie, path, options = {}) {
  return jsonRequest(path, {
    ...options,
    headers: {
      Cookie: cookie,
      ...(options.headers || {}),
    },
  });
}

async function expectStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    label + ": " + JSON.stringify(result.data),
  );
  return result.data;
}

async function createRoleUser(schoolId, role, suffix) {
  const email = role.toLowerCase() + "-" + suffix + "@regression.invalid";
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      schoolId,
      name: "Regression " + role,
      email,
      password: hash,
      role,
      active: true,
    },
  });

  return { ...user, email };
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const schoolA = await prisma.school.create({
    data: {
      name: "Regression School A " + suffix,
      slug: "regression-a-" + suffix,
      lifecycleStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
    },
  });

  const schoolB = await prisma.school.create({
    data: {
      name: "Regression School B " + suffix,
      slug: "regression-b-" + suffix,
      lifecycleStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
    },
  });

  try {
    const [secretary, coordinator, finance] = await Promise.all([
      createRoleUser(schoolA.id, "SECRETARY", suffix),
      createRoleUser(schoolA.id, "COORDINATOR", suffix),
      createRoleUser(schoolA.id, "FINANCE", suffix),
    ]);

    const [secretaryCookie, coordinatorCookie, financeCookie] =
      await Promise.all([
        login(secretary.email),
        login(coordinator.email),
        login(finance.email),
      ]);

    const me = await authed(secretaryCookie, "/api/auth/me");
    await expectStatus(me, 200, "authenticated session");

    const guardianKey = "reg-guardian-" + suffix;
    const guardianCreate = await authed(secretaryCookie, "/api/guardians", {
      method: "POST",
      headers: { "Idempotency-Key": guardianKey },
      body: JSON.stringify({
        name: "Responsável Regression",
        phone: "85999990001",
        email: "guardian-" + suffix + "@example.invalid",
      }),
    });
    const guardianData = await expectStatus(
      guardianCreate,
      201,
      "guardian create",
    );

    const guardianReplay = await authed(secretaryCookie, "/api/guardians", {
      method: "POST",
      headers: { "Idempotency-Key": guardianKey },
      body: JSON.stringify({
        name: "Responsável Regression",
        phone: "85999990001",
        email: "guardian-" + suffix + "@example.invalid",
      }),
    });
    await expectStatus(guardianReplay, 201, "guardian replay");
    assert.equal(
      guardianReplay.data.guardian.id,
      guardianData.guardian.id,
    );
    assert.equal(
      guardianReplay.response.headers.get("idempotent-replay"),
      "true",
    );

    const studentKey = "reg-student-" + suffix;
    const studentCreate = await authed(secretaryCookie, "/api/students", {
      method: "POST",
      headers: { "Idempotency-Key": studentKey },
      body: JSON.stringify({
        name: "Aluno Regression",
        registration: "REG-" + suffix,
        email: "student-" + suffix + "@example.invalid",
      }),
    });
    const studentData = await expectStatus(studentCreate, 201, "student create");

    const studentReplay = await authed(secretaryCookie, "/api/students", {
      method: "POST",
      headers: { "Idempotency-Key": studentKey },
      body: JSON.stringify({
        name: "Aluno Regression",
        registration: "REG-" + suffix,
        email: "student-" + suffix + "@example.invalid",
      }),
    });
    await expectStatus(studentReplay, 201, "student replay");
    assert.equal(studentReplay.data.student.id, studentData.student.id);

    const teacherKey = "reg-teacher-" + suffix;
    const teacherCreate = await authed(secretaryCookie, "/api/teachers", {
      method: "POST",
      headers: { "Idempotency-Key": teacherKey },
      body: JSON.stringify({
        name: "Professor Regression",
        email: "teacher-" + suffix + "@example.invalid",
        specialty: "Matemática",
      }),
    });
    const teacherData = await expectStatus(teacherCreate, 201, "teacher create");

    const teacherReplay = await authed(secretaryCookie, "/api/teachers", {
      method: "POST",
      headers: { "Idempotency-Key": teacherKey },
      body: JSON.stringify({
        name: "Professor Regression",
        email: "teacher-" + suffix + "@example.invalid",
        specialty: "Matemática",
      }),
    });
    await expectStatus(teacherReplay, 201, "teacher replay");
    assert.equal(teacherReplay.data.teacher.id, teacherData.teacher.id);

    const classKey = "reg-class-" + suffix;
    const classCreate = await authed(secretaryCookie, "/api/classes", {
      method: "POST",
      headers: { "Idempotency-Key": classKey },
      body: JSON.stringify({
        name: "1A Regression",
        gradeLevel: "1º ano",
        shift: "Manhã",
        schoolYear: 2026,
        capacity: 30,
        teacherId: teacherData.teacher.id,
      }),
    });
    const classData = await expectStatus(classCreate, 201, "class create");

    const classReplay = await authed(secretaryCookie, "/api/classes", {
      method: "POST",
      headers: { "Idempotency-Key": classKey },
      body: JSON.stringify({
        name: "1A Regression",
        gradeLevel: "1º ano",
        shift: "Manhã",
        schoolYear: 2026,
        capacity: 30,
        teacherId: teacherData.teacher.id,
      }),
    });
    await expectStatus(classReplay, 201, "class replay");
    assert.equal(classReplay.data.class.id, classData.class.id);

    await prisma.studentGuardian.create({
      data: {
        studentId: studentData.student.id,
        guardianId: guardianData.guardian.id,
        relationship: "Responsável",
        financialResponsible: true,
        authorizedPickup: true,
      },
    });

    const enrollmentKey = "reg-enrollment-" + suffix;
    const enrollmentCreate = await authed(
      secretaryCookie,
      "/api/enrollments",
      {
        method: "POST",
        headers: { "Idempotency-Key": enrollmentKey },
        body: JSON.stringify({
          studentId: studentData.student.id,
          classId: classData.class.id,
          status: "ACTIVE",
          startedAt: "2026-01-20",
        }),
      },
    );
    const enrollmentData = await expectStatus(
      enrollmentCreate,
      201,
      "enrollment create",
    );

    const enrollmentReplay = await authed(
      secretaryCookie,
      "/api/enrollments",
      {
        method: "POST",
        headers: { "Idempotency-Key": enrollmentKey },
        body: JSON.stringify({
          studentId: studentData.student.id,
          classId: classData.class.id,
          status: "ACTIVE",
          startedAt: "2026-01-20",
        }),
      },
    );
    await expectStatus(enrollmentReplay, 201, "enrollment replay");
    assert.equal(
      enrollmentReplay.data.enrollment.id,
      enrollmentData.enrollment.id,
    );

    const foreignClass = await prisma.classGroup.create({
      data: {
        schoolId: schoolB.id,
        name: "Foreign Class",
        gradeLevel: "1º ano",
        shift: "Tarde",
        schoolYear: 2027,
      },
    });

    const crossTenant = await authed(secretaryCookie, "/api/enrollments", {
      method: "POST",
      headers: { "Idempotency-Key": "cross-" + suffix },
      body: JSON.stringify({
        studentId: studentData.student.id,
        classId: foreignClass.id,
      }),
    });
    assert.equal(crossTenant.response.status, 404);

    const subjectCreate = await authed(secretaryCookie, "/api/subjects", {
      method: "POST",
      body: JSON.stringify({
        name: "Matemática Regression " + suffix,
        code: "MAT-" + suffix.toUpperCase(),
      }),
    });
    const subjectData = await expectStatus(subjectCreate, 201, "subject create");

    const periodCreate = await authed(secretaryCookie, "/api/academic-periods", {
      method: "POST",
      body: JSON.stringify({
        schoolYear: 2026,
        order: 1,
        name: "1º Bimestre",
        startDate: "2026-02-01T12:00:00.000Z",
        endDate: "2026-04-30T12:00:00.000Z",
        weight: 1,
        status: "ACTIVE",
      }),
    });
    const periodData = await expectStatus(periodCreate, 201, "period create");

    const classSubject = await prisma.classSubject.create({
      data: {
        classId: classData.class.id,
        subjectId: subjectData.subject.id,
        teacherId: teacherData.teacher.id,
      },
    });

    const assessmentCreate = await authed(
      coordinatorCookie,
      "/api/assessments",
      {
        method: "POST",
        body: JSON.stringify({
          classSubjectId: classSubject.id,
          periodId: periodData.period.id,
          title: "Prova Regression",
          type: "EXAM",
          status: "PUBLISHED",
          assessmentDate: "2026-03-15T12:00:00.000Z",
          maxScore: 10,
          weight: 1,
        }),
      },
    );
    await expectStatus(assessmentCreate, 201, "assessment create");

    const lessonCreate = await authed(coordinatorCookie, "/api/lessons", {
      method: "POST",
      body: JSON.stringify({
        classSubjectId: classSubject.id,
        periodId: periodData.period.id,
        lessonDate: "2026-03-10",
        startTime: "08:00",
        endTime: "08:50",
        plannedContent: "Regressão ponta a ponta",
        status: "COMPLETED",
      }),
    });
    await expectStatus(lessonCreate, 201, "lesson create");

    const planCreate = await authed(financeCookie, "/api/finance/plans", {
      method: "POST",
      body: JSON.stringify({
        name: "Plano Regression " + suffix,
        schoolYear: 2026,
        installmentAmount: 100,
        installments: 2,
        dueDay: 10,
      }),
    });
    const planData = await expectStatus(planCreate, 201, "billing plan create");

    const contractCreate = await authed(financeCookie, "/api/finance/contracts", {
      method: "POST",
      body: JSON.stringify({
        enrollmentId: enrollmentData.enrollment.id,
        billingPlanId: planData.plan.id,
        firstDueDate: "2026-02-10",
      }),
    });
    const contractData = await expectStatus(
      contractCreate,
      201,
      "billing contract create",
    );

    const generateKey = "reg-generate-" + suffix;
    const generate = await authed(
      financeCookie,
      "/api/finance/contracts/" + contractData.contract.id + "/generate",
      {
        method: "POST",
        headers: { "Idempotency-Key": generateKey },
      },
    );
    const generateData = await expectStatus(generate, 200, "charge generation");
    assert.equal(generateData.created, 2);
    assert.equal(generateData.charges.length, 2);

    const generateReplay = await authed(
      financeCookie,
      "/api/finance/contracts/" + contractData.contract.id + "/generate",
      {
        method: "POST",
        headers: { "Idempotency-Key": generateKey },
      },
    );
    await expectStatus(generateReplay, 200, "charge generation replay");
    assert.equal(
      generateReplay.response.headers.get("idempotent-replay"),
      "true",
    );
    assert.equal(
      generateReplay.data.charges[0].id,
      generateData.charges[0].id,
    );

    const chargeList = await authed(
      financeCookie,
      "/api/finance/charges?page=1&pageSize=1",
    );
    const chargeListData = await expectStatus(chargeList, 200, "charge list");
    assert.equal(chargeListData.charges.length, 1);
    assert.ok(chargeListData.meta.total >= 2);

    const paymentKey = "reg-payment-" + suffix;
    const payment = await authed(
      financeCookie,
      "/api/finance/charges/" + generateData.charges[0].id + "/payments",
      {
        method: "POST",
        headers: { "Idempotency-Key": paymentKey },
        body: JSON.stringify({
          amount: Number(generateData.charges[0].amount),
          method: "PIX",
          paidAt: "2026-02-10",
          note: "Regression",
        }),
      },
    );
    const paymentData = await expectStatus(payment, 201, "manual payment");

    const paymentReplay = await authed(
      financeCookie,
      "/api/finance/charges/" + generateData.charges[0].id + "/payments",
      {
        method: "POST",
        headers: { "Idempotency-Key": paymentKey },
        body: JSON.stringify({
          amount: Number(generateData.charges[0].amount),
          method: "PIX",
          paidAt: "2026-02-10",
          note: "Regression",
        }),
      },
    );
    await expectStatus(paymentReplay, 201, "manual payment replay");
    assert.equal(
      paymentReplay.data.payment.id,
      paymentData.payment.id,
    );

    const documentKey = "reg-document-" + suffix;
    const document = await authed(financeCookie, "/api/documents", {
      method: "POST",
      headers: { "Idempotency-Key": documentKey },
      body: JSON.stringify({
        type: "PAYMENT_RECEIPT",
        chargeId: generateData.charges[0].id,
        guardianId: guardianData.guardian.id,
      }),
    });
    const documentData = await expectStatus(document, 201, "receipt document");

    const documentReplay = await authed(financeCookie, "/api/documents", {
      method: "POST",
      headers: { "Idempotency-Key": documentKey },
      body: JSON.stringify({
        type: "PAYMENT_RECEIPT",
        chargeId: generateData.charges[0].id,
        guardianId: guardianData.guardian.id,
      }),
    });
    await expectStatus(documentReplay, 201, "receipt document replay");
    assert.equal(
      documentReplay.data.document.id,
      documentData.document.id,
    );

    const communication = await authed(
      coordinatorCookie,
      "/api/communications",
      {
        method: "POST",
        body: JSON.stringify({
          title: "Comunicado Regression",
          content: "Fluxo de regressão ponta a ponta.",
          audience: "STUDENTS",
          priority: "NORMAL",
        }),
      },
    );
    const communicationData = await expectStatus(
      communication,
      201,
      "communication create",
    );

    const published = await authed(
      coordinatorCookie,
      "/api/communications/" +
        communicationData.communication.id +
        "/publish",
      { method: "POST" },
    );
    const publishedData = await expectStatus(
      published,
      200,
      "communication publish",
    );
    assert.ok(publishedData.recipients >= 1);

    const teachersPage = await authed(
      secretaryCookie,
      "/api/teachers?page=1&pageSize=1",
    );
    const teachersPageData = await expectStatus(
      teachersPage,
      200,
      "teacher pagination",
    );
    assert.equal(teachersPageData.teachers.length, 1);
    assert.ok(teachersPageData.meta.total >= 1);

    const classesPage = await authed(
      secretaryCookie,
      "/api/classes?page=1&pageSize=1",
    );
    const classesPageData = await expectStatus(
      classesPage,
      200,
      "class pagination",
    );
    assert.equal(classesPageData.classes.length, 1);
    assert.ok(classesPageData.meta.total >= 1);

    const privacyExport = await authed(
      secretaryCookie,
      "/api/privacy/export",
    );
    assert.equal(privacyExport.response.status, 200);

    const paymentCount = await prisma.payment.count({
      where: { chargeId: generateData.charges[0].id },
    });
    assert.equal(paymentCount, 1);

    const enrollmentCount = await prisma.enrollment.count({
      where: {
        studentId: studentData.student.id,
        classId: classData.class.id,
      },
    });
    assert.equal(enrollmentCount, 1);

    console.log("HTTP end-to-end regression: OK");
  } finally {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA.id, schoolB.id] } },
    }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  process.exitCode = 1;
});
