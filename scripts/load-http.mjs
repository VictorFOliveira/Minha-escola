import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const baseUrl = (process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const password = "LoadTest-2026!Secure";
const sustainedRequests = Number(process.env.LOAD_SUSTAINED_REQUESTS || 400);
const sustainedConcurrency = Number(process.env.LOAD_SUSTAINED_CONCURRENCY || 40);
const burstRequests = Number(process.env.LOAD_BURST_REQUESTS || 200);
const burstConcurrency = Number(process.env.LOAD_BURST_CONCURRENCY || 100);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Login não retornou cookie.");
  return raw.split(";")[0];
}

async function login(actor, ipIndex) {
  const response = await fetch(baseUrl + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "10.77.0." + ((ipIndex % 240) + 10),
    },
    body: JSON.stringify({
      email: actor.email,
      password,
    }),
  });

  const body = await response.json().catch(() => ({}));
  assert.equal(
    response.status,
    200,
    actor.role + " login falhou: " + JSON.stringify(body),
  );
  assert.equal(body?.mfaRequired, undefined);
  return { ...actor, cookie: cookieFrom(response) };
}

function endpointFor(actor, requestIndex) {
  if (actor.role === "STUDENT") {
    const endpoints = [
      "/api/auth/me",
      "/api/communications/inbox",
      "/api/documents/mine",
    ];
    return endpoints[requestIndex % endpoints.length];
  }

  if (actor.role === "TEACHER") {
    const endpoints = [
      "/api/auth/me",
      "/api/classes?page=1&pageSize=50",
      "/api/enrollments?page=1&pageSize=50",
    ];
    return endpoints[requestIndex % endpoints.length];
  }

  if (actor.role === "COORDINATOR") {
    const endpoints = [
      "/api/auth/me",
      "/api/classes?page=1&pageSize=50",
      "/api/enrollments?page=1&pageSize=50",
      "/api/academic-periods",
    ];
    return endpoints[requestIndex % endpoints.length];
  }

  if (actor.role === "FINANCE") {
    const endpoints = [
      "/api/finance/summary",
      "/api/finance/charges?page=1&pageSize=50",
      "/api/finance/contracts?page=1&pageSize=50",
      "/api/finance/plans",
    ];
    return endpoints[requestIndex % endpoints.length];
  }

  const studentPage = (requestIndex % 20) + 1;
  const endpoints = [
    "/api/students?page=" + studentPage + "&pageSize=50",
    "/api/teachers?page=1&pageSize=50",
    "/api/classes?page=1&pageSize=50",
    "/api/enrollments?page=1&pageSize=50",
  ];
  return endpoints[requestIndex % endpoints.length];
}

async function runPhase(name, actors, totalRequests, concurrency) {
  const latencies = [];
  const statusCounts = new Map();
  const roleCounts = new Map();
  const endpointCounts = new Map();
  const failures = [];

  let cursor = 0;
  const started = performance.now();

  async function worker(workerId) {
    while (true) {
      const index = cursor++;
      if (index >= totalRequests) return;

      const actor = actors[index % actors.length];
      const path = endpointFor(actor, index + workerId);
      const requestStarted = performance.now();

      try {
        const response = await fetch(baseUrl + path, {
          headers: {
            Cookie: actor.cookie,
            "X-Load-Test": name,
            "X-Forwarded-For":
              "10.88." +
              ((workerId % 200) + 1) +
              "." +
              ((index % 240) + 10),
          },
          cache: "no-store",
        });
        const elapsed = performance.now() - requestStarted;
        latencies.push(elapsed);

        statusCounts.set(
          response.status,
          (statusCounts.get(response.status) || 0) + 1,
        );
        roleCounts.set(actor.role, (roleCounts.get(actor.role) || 0) + 1);
        endpointCounts.set(path, (endpointCounts.get(path) || 0) + 1);

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          failures.push({
            index,
            role: actor.role,
            path,
            status: response.status,
            body: body.slice(0, 300),
          });
        } else {
          await response.arrayBuffer();
        }
      } catch (error) {
        const elapsed = performance.now() - requestStarted;
        latencies.push(elapsed);
        failures.push({
          index,
          role: actor.role,
          path,
          status: 0,
          body: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, totalRequests) },
      (_, index) => worker(index),
    ),
  );

  const elapsed = performance.now() - started;
  const success = totalRequests - failures.length;
  const result = {
    name,
    totalRequests,
    concurrency,
    success,
    failures: failures.length,
    errorRate: totalRequests ? failures.length / totalRequests : 0,
    elapsedMs: elapsed,
    requestsPerSecond: totalRequests / (elapsed / 1000),
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    maxMs: Math.max(0, ...latencies),
    statusCounts: Object.fromEntries(
      [...statusCounts.entries()].sort((a, b) => a[0] - b[0]),
    ),
    roleCounts: Object.fromEntries(roleCounts.entries()),
    topEndpoints: [...endpointCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    sampleFailures: failures.slice(0, 10),
  };

  console.log("\n=== " + name + " ===");
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function createFixture() {
  const suffix = randomUUID().slice(0, 8);
  const hash = await bcrypt.hash(password, 12);

  const school = await prisma.school.create({
    data: {
      name: "Load School " + suffix,
      slug: "load-school-" + suffix,
      lifecycleStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
    },
  });

  const teacherRecords = [];
  for (let index = 0; index < 10; index += 1) {
    teacherRecords.push(
      await prisma.teacher.create({
        data: {
          schoolId: school.id,
          name: "Professor Load " + index,
          email: "teacher-load-" + suffix + "-" + index + "@example.invalid",
          specialty: "Disciplina " + index,
          status: "ACTIVE",
        },
      }),
    );
  }

  const classes = [];
  for (let index = 0; index < 10; index += 1) {
    classes.push(
      await prisma.classGroup.create({
        data: {
          schoolId: school.id,
          name: "Turma Load " + index,
          gradeLevel: ((index % 5) + 1) + "º ano",
          shift: index % 2 === 0 ? "Manhã" : "Tarde",
          schoolYear: 2026,
          capacity: 800,
          teacherId: teacherRecords[index].id,
        },
      }),
    );
  }

  const subjects = [];
  for (let index = 0; index < 10; index += 1) {
    const subject = await prisma.subject.create({
      data: {
        schoolId: school.id,
        name: "Disciplina Load " + index,
        code: "LOAD-" + suffix + "-" + index,
      },
    });
    subjects.push(subject);

    await prisma.classSubject.create({
      data: {
        classId: classes[index].id,
        subjectId: subject.id,
        teacherId: teacherRecords[index].id,
      },
    });
  }

  const students = Array.from({ length: 5000 }, (_, index) => ({
    schoolId: school.id,
    registration: "LOAD-" + suffix + "-" + String(index).padStart(5, "0"),
    name: "Aluno Load " + String(index).padStart(5, "0"),
    email: "student-data-" + suffix + "-" + index + "@example.invalid",
    status: "ACTIVE",
  }));

  const seedStarted = performance.now();
  await prisma.student.createMany({ data: students });
  const seedElapsedMs = performance.now() - seedStarted;

  const selectedStudents = await prisma.student.findMany({
    where: { schoolId: school.id },
    orderBy: { registration: "asc" },
    take: 120,
  });

  const enrollments = [];
  for (let index = 0; index < selectedStudents.length; index += 1) {
    enrollments.push(
      await prisma.enrollment.create({
        data: {
          studentId: selectedStudents[index].id,
          classId: classes[index % classes.length].id,
          status: "ACTIVE",
          type: "NEW",
          startedAt: new Date("2026-01-20T12:00:00.000Z"),
        },
      }),
    );
  }

  const actors = [];

  for (let index = 0; index < 20; index += 1) {
    const email = "student-user-" + suffix + "-" + index + "@regression.invalid";
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: "Aluno User " + index,
        email,
        password: hash,
        role: "STUDENT",
        active: true,
        enrollmentId: enrollments[index].id,
      },
    });
    actors.push({ id: user.id, email, role: "STUDENT" });
  }

  for (let index = 0; index < teacherRecords.length; index += 1) {
    const email = "teacher-user-" + suffix + "-" + index + "@regression.invalid";
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: "Professor User " + index,
        email,
        password: hash,
        role: "TEACHER",
        active: true,
        teacherId: teacherRecords[index].id,
      },
    });
    actors.push({ id: user.id, email, role: "TEACHER" });
  }

  for (const role of ["COORDINATOR", "SECRETARY", "FINANCE"]) {
    for (let index = 0; index < 3; index += 1) {
      const email =
        role.toLowerCase() +
        "-user-" +
        suffix +
        "-" +
        index +
        "@regression.invalid";
      const user = await prisma.user.create({
        data: {
          schoolId: school.id,
          name: role + " User " + index,
          email,
          password: hash,
          role,
          active: true,
        },
      });
      actors.push({ id: user.id, email, role });
    }
  }

  const dueBase = Date.UTC(2026, 0, 1);
  const chargeRows = Array.from({ length: 3000 }, (_, index) => ({
    schoolId: school.id,
    studentId: selectedStudents[index % selectedStudents.length].id,
    description: "Mensalidade Load " + index,
    baseAmount: 100 + (index % 5) * 10,
    amount: 100 + (index % 5) * 10,
    paidAmount: index % 7 === 0 ? 50 : 0,
    dueDate: new Date(dueBase + (index % 365) * 86_400_000),
    status: index % 7 === 0 ? "PARTIAL" : "PENDING",
    provider: "MANUAL",
  }));

  const chargeSeedStarted = performance.now();
  await prisma.charge.createMany({ data: chargeRows });
  const chargeSeedElapsedMs = performance.now() - chargeSeedStarted;

  const period = await prisma.academicPeriod.create({
    data: {
      schoolId: school.id,
      schoolYear: 2026,
      order: 1,
      name: "1º Bimestre Load",
      startDate: new Date("2026-02-01T12:00:00.000Z"),
      endDate: new Date("2026-04-30T12:00:00.000Z"),
      weight: 1,
      status: "ACTIVE",
    },
  });

  return {
    school,
    actors,
    seedElapsedMs,
    chargeSeedElapsedMs,
    period,
  };
}

async function main() {
  const fixture = await createFixture();
  console.log(
    "Fixture: 5.000 alunos, 3.000 cobranças, " +
      fixture.actors.length +
      " usuários concorrentes.",
  );
  console.log(
    "Seed alunos: " +
      fixture.seedElapsedMs.toFixed(1) +
      " ms; cobranças: " +
      fixture.chargeSeedElapsedMs.toFixed(1) +
      " ms",
  );

  try {
    const actors = [];
    for (let index = 0; index < fixture.actors.length; index += 1) {
      actors.push(await login(fixture.actors[index], index));
    }

    const sustained = await runPhase(
      "sustained",
      actors,
      sustainedRequests,
      sustainedConcurrency,
    );

    const burst = await runPhase(
      "burst",
      actors,
      burstRequests,
      burstConcurrency,
    );

    const totalRequests = sustained.totalRequests + burst.totalRequests;
    const totalFailures = sustained.failures + burst.failures;
    const overallErrorRate = totalFailures / totalRequests;

    const final = {
      totalRequests,
      totalFailures,
      overallErrorRate,
      sustainedP95Ms: sustained.p95Ms,
      burstP95Ms: burst.p95Ms,
      sustainedP99Ms: sustained.p99Ms,
      burstP99Ms: burst.p99Ms,
    };

    console.log("\n=== RESULTADO FINAL ===");
    console.log(JSON.stringify(final, null, 2));

    assert.equal(
      totalFailures,
      0,
      "O teste teve " + totalFailures + " requisição(ões) com falha.",
    );
    assert.ok(
      sustained.p95Ms < 1500,
      "p95 sustentado acima de 1500 ms: " + sustained.p95Ms.toFixed(1),
    );
    assert.ok(
      burst.p95Ms < 2500,
      "p95 da rajada acima de 2500 ms: " + burst.p95Ms.toFixed(1),
    );
  } finally {
    await prisma.school.delete({
      where: { id: fixture.school.id },
    }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  process.exitCode = 1;
});
