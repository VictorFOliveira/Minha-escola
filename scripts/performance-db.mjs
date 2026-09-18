import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assertBudget(label, milliseconds, budget) {
  console.log(label + ": " + milliseconds.toFixed(1) + " ms");
  if (milliseconds > budget) {
    throw new Error(
      label + " excedeu o orçamento de " + budget + " ms (" +
      milliseconds.toFixed(1) + " ms).",
    );
  }
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const school = await prisma.school.create({
    data: {
      name: "Performance " + suffix,
      slug: "performance-" + suffix,
      lifecycleStatus: "ACTIVE",
    },
  });

  try {
    const students = Array.from({ length: 5000 }, (_, index) => ({
      schoolId: school.id,
      registration: "P-" + suffix + "-" + String(index).padStart(5, "0"),
      name: "Aluno " + String(index).padStart(5, "0"),
      status: "ACTIVE",
    }));

    const seedStarted = performance.now();
    await prisma.student.createMany({ data: students });
    const seedElapsed = performance.now() - seedStarted;
    assertBudget("seed 5k students", seedElapsed, 15000);

    const firstStudent = await prisma.student.findFirstOrThrow({
      where: { schoolId: school.id },
      select: { id: true },
    });

    const dueBase = Date.UTC(2026, 0, 1);
    const charges = Array.from({ length: 3000 }, (_, index) => ({
      schoolId: school.id,
      studentId: firstStudent.id,
      description: "Mensalidade " + index,
      baseAmount: 100,
      amount: 100,
      dueDate: new Date(dueBase + index * 86_400_000),
      status: "PENDING",
      provider: "MANUAL",
    }));

    const chargeSeedStarted = performance.now();
    await prisma.charge.createMany({ data: charges });
    const chargeSeedElapsed = performance.now() - chargeSeedStarted;
    assertBudget("seed 3k charges", chargeSeedElapsed, 15000);

    const studentQueryStarted = performance.now();
    for (let page = 0; page < 60; page += 1) {
      await prisma.student.findMany({
        where: { schoolId: school.id },
        orderBy: { name: "asc" },
        skip: page * 50,
        take: 50,
        select: {
          id: true,
          registration: true,
          name: true,
          status: true,
        },
      });
    }
    const studentQueryElapsed = performance.now() - studentQueryStarted;
    assertBudget("60 paginated student queries", studentQueryElapsed, 12000);

    const chargeQueryStarted = performance.now();
    for (let page = 0; page < 40; page += 1) {
      await prisma.charge.findMany({
        where: {
          schoolId: school.id,
          status: "PENDING",
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        skip: page * 50,
        take: 50,
        select: {
          id: true,
          dueDate: true,
          amount: true,
          status: true,
        },
      });
    }
    const chargeQueryElapsed = performance.now() - chargeQueryStarted;
    assertBudget("40 paginated charge queries", chargeQueryElapsed, 12000);

    console.log("Performance database gate: OK");
  } finally {
    await prisma.school.delete({ where: { id: school.id } }).catch(() => null);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  process.exitCode = 1;
});
