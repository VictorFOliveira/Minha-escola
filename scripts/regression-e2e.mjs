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

    const bruteEmail = "brute-" + suffix + "@regression.invalid";
    const bruteResults = await Promise.all(
      Array.from({ length: 15 }, () =>
        jsonRequest("/api/auth/login", {
          method: "POST",
          headers: { "X-Forwarded-For": "198.51.100.77" },
          body: JSON.stringify({
            email: bruteEmail,
            password: "senha-incorreta",
          }),
        }),
      ),
    );
    const bruteStatuses = bruteResults.map((item) => item.response.status);
    assert.equal(
      bruteStatuses.filter((status) => status === 401).length,
      10,
      "rate limit deve permitir somente as 10 primeiras tentativas da conta",
    );
    assert.equal(
      bruteStatuses.filter((status) => status === 429).length,
      5,
      "rate limit deve bloquear a rajada após o limite da conta",
    );
    assert.equal(
      bruteStatuses.some((status) => status >= 500),
      false,
      "rajada de login não pode gerar 5xx",
    );

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

    const invalidBirthDate = await authed(secretaryCookie, "/api/students", {
      method: "POST",
      body: JSON.stringify({
        name: "Aluno Data Inválida",
        registration: "BAD-DATE-" + suffix,
        birthDate: "isto-nao-e-uma-data",
      }),
    });
    await expectStatus(invalidBirthDate, 400, "invalid student birth date");

    const oversizedKey = await authed(secretaryCookie, "/api/students", {
      method: "POST",
      headers: { "Idempotency-Key": "x".repeat(201) },
      body: JSON.stringify({
        name: "Aluno Chave Inválida",
        registration: "BAD-KEY-" + suffix,
      }),
    });
    await expectStatus(oversizedKey, 400, "oversized idempotency key");

    const concurrentStudentKey = "race-student-" + suffix;
    const concurrentStudentPayload = JSON.stringify({
      name: "Aluno Concorrente",
      registration: "RACE-" + suffix,
      email: "race-student-" + suffix + "@example.invalid",
    });
    const concurrentStudents = await Promise.all(
      Array.from({ length: 20 }, () =>
        authed(secretaryCookie, "/api/students", {
          method: "POST",
          headers: { "Idempotency-Key": concurrentStudentKey },
          body: concurrentStudentPayload,
        }),
      ),
    );

    for (const item of concurrentStudents) {
      await expectStatus(item, 201, "concurrent idempotent student");
    }

    const concurrentStudentIds = new Set(
      concurrentStudents.map((item) => item.data.student.id),
    );
    assert.equal(
      concurrentStudentIds.size,
      1,
      "20 requests com a mesma chave devem produzir um único aluno",
    );
    assert.equal(
      await prisma.student.count({
        where: {
          schoolId: schoolA.id,
          registration: "RACE-" + suffix,
        },
      }),
      1,
    );

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

    const raceEnrollmentStudent = await prisma.student.create({
      data: {
        schoolId: schoolA.id,
        name: "Aluno Matrícula Concorrente",
        registration: "RACE-ENROLL-" + suffix,
        status: "ACTIVE",
      },
    });
    await prisma.studentGuardian.create({
      data: {
        studentId: raceEnrollmentStudent.id,
        guardianId: guardianData.guardian.id,
        relationship: "Responsável",
        financialResponsible: true,
        authorizedPickup: true,
      },
    });

    const concurrentEnrollmentKey = "race-enrollment-" + suffix;
    const concurrentEnrollments = await Promise.all(
      Array.from({ length: 20 }, () =>
        authed(secretaryCookie, "/api/enrollments", {
          method: "POST",
          headers: { "Idempotency-Key": concurrentEnrollmentKey },
          body: JSON.stringify({
            studentId: raceEnrollmentStudent.id,
            classId: classData.class.id,
            status: "ACTIVE",
            startedAt: "2026-01-21",
          }),
        }),
      ),
    );
    for (const item of concurrentEnrollments) {
      await expectStatus(item, 201, "concurrent idempotent enrollment");
    }
    assert.equal(
      new Set(
        concurrentEnrollments.map((item) => item.data.enrollment.id),
      ).size,
      1,
      "20 matrículas com a mesma chave devem produzir um único registro",
    );
    assert.equal(
      await prisma.enrollment.count({
        where: {
          studentId: raceEnrollmentStudent.id,
          classId: classData.class.id,
        },
      }),
      1,
    );

    const invalidEnrollmentDate = await authed(
      secretaryCookie,
      "/api/enrollments",
      {
        method: "POST",
        body: JSON.stringify({
          studentId: raceEnrollmentStudent.id,
          classId: classData.class.id,
          startedAt: "data-impossivel",
        }),
      },
    );
    await expectStatus(
      invalidEnrollmentDate,
      400,
      "invalid enrollment start date",
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
        installments: 3,
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
    const concurrentGeneration = await Promise.all(
      Array.from({ length: 12 }, () =>
        authed(
          financeCookie,
          "/api/finance/contracts/" + contractData.contract.id + "/generate",
          {
            method: "POST",
            headers: { "Idempotency-Key": generateKey },
          },
        ),
      ),
    );

    for (const item of concurrentGeneration) {
      await expectStatus(item, 200, "concurrent charge generation");
    }

    const generateData = concurrentGeneration[0].data;
    assert.equal(generateData.created, 3);
    assert.equal(generateData.charges.length, 3);
    assert.equal(
      new Set(
        concurrentGeneration.map((item) =>
          item.data.charges.map((charge) => charge.id).join(","),
        ),
      ).size,
      1,
      "geração concorrente com a mesma chave deve devolver o mesmo conjunto",
    );
    assert.equal(
      await prisma.charge.count({
        where: { contractId: contractData.contract.id },
      }),
      3,
      "geração concorrente não pode duplicar mensalidades",
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

    const raceCharge = generateData.charges[1];
    const doublePaymentResults = await Promise.all([
      authed(
        financeCookie,
        "/api/finance/charges/" + raceCharge.id + "/payments",
        {
          method: "POST",
          headers: { "Idempotency-Key": "double-a-" + suffix },
          body: JSON.stringify({
            amount: Number(raceCharge.amount),
            method: "PIX",
            paidAt: "2026-03-10",
            note: "Corrida A",
          }),
        },
      ),
      authed(
        financeCookie,
        "/api/finance/charges/" + raceCharge.id + "/payments",
        {
          method: "POST",
          headers: { "Idempotency-Key": "double-b-" + suffix },
          body: JSON.stringify({
            amount: Number(raceCharge.amount),
            method: "PIX",
            paidAt: "2026-03-10",
            note: "Corrida B",
          }),
        },
      ),
    ]);

    assert.deepEqual(
      doublePaymentResults
        .map((item) => item.response.status)
        .sort((a, b) => a - b),
      [201, 409],
      "dois pagamentos integrais concorrentes devem aceitar apenas um",
    );
    assert.equal(
      await prisma.payment.count({ where: { chargeId: raceCharge.id } }),
      1,
      "corrida de pagamento não pode criar duas baixas",
    );

    const sameKeyCharge = generateData.charges[2];
    const samePaymentKey = "same-payment-" + suffix;
    const sameKeyPayments = await Promise.all(
      Array.from({ length: 12 }, () =>
        authed(
          financeCookie,
          "/api/finance/charges/" + sameKeyCharge.id + "/payments",
          {
            method: "POST",
            headers: { "Idempotency-Key": samePaymentKey },
            body: JSON.stringify({
              amount: Number(sameKeyCharge.amount),
              method: "PIX",
              paidAt: "2026-04-10",
              note: "Mesmo pagamento concorrente",
            }),
          },
        ),
      ),
    );
    for (const item of sameKeyPayments) {
      await expectStatus(item, 201, "concurrent same-key payment");
    }
    assert.equal(
      new Set(sameKeyPayments.map((item) => item.data.payment.id)).size,
      1,
      "mesma chave deve devolver sempre o mesmo pagamento",
    );
    assert.equal(
      await prisma.payment.count({
        where: { chargeId: sameKeyCharge.id },
      }),
      1,
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

    const abusedPagination = await authed(
      secretaryCookie,
      "/api/students?page=-999&pageSize=999999",
    );
    const abusedPaginationData = await expectStatus(
      abusedPagination,
      200,
      "pagination abuse",
    );
    assert.equal(abusedPaginationData.meta.page, 1);
    assert.equal(abusedPaginationData.meta.pageSize, 100);

    const forbiddenFlood = await Promise.all(
      Array.from({ length: 30 }, () =>
        authed(financeCookie, "/api/students?page=1&pageSize=1"),
      ),
    );
    assert.equal(
      forbiddenFlood.every((item) => item.response.status === 403),
      true,
      "perfil financeiro nunca pode ler cadastro de alunos",
    );

    const dashboard = await authed(secretaryCookie, "/dashboard");
    assert.equal(dashboard.response.status, 200);
    assert.equal(
      typeof dashboard.data === "string" &&
        dashboard.data.includes("842"),
      false,
      "dashboard não pode reintroduzir a métrica mock antiga",
    );
    assert.equal(
      typeof dashboard.data === "string" &&
        dashboard.data.includes("Aluno Regression"),
      true,
      "dashboard deve renderizar aluno real do tenant",
    );

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
