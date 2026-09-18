import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import {
  idempotencyHash,
  readIdempotency,
  saveIdempotency,
} from "../../lib/idempotency";

test("idempotency records replay only inside the same tenant and operation", async () => {
  const suffix = randomUUID().slice(0, 8);
  const [schoolA, schoolB] = await Promise.all([
    prisma.school.create({
      data: {
        name: "Idempotency A " + suffix,
        slug: "idem-a-" + suffix,
        lifecycleStatus: "ACTIVE",
      },
    }),
    prisma.school.create({
      data: {
        name: "Idempotency B " + suffix,
        slug: "idem-b-" + suffix,
        lifecycleStatus: "ACTIVE",
      },
    }),
  ]);

  try {
    const request = new Request("https://example.test/api/students", {
      headers: { "Idempotency-Key": "same-request-123" },
    });

    const keyHash = idempotencyHash(request, schoolA.id, "student.create");
    assert.ok(keyHash);

    await saveIdempotency({
      schoolId: schoolA.id,
      operation: "student.create",
      keyHash,
      responseStatus: 201,
      responseBody: { student: { id: "student-1" } },
      resourceId: "student-1",
    });

    const replay = await readIdempotency(
      request,
      schoolA.id,
      "student.create",
    );

    assert.equal(replay?.responseStatus, 201);
    assert.deepEqual(replay?.responseBody, {
      student: { id: "student-1" },
    });

    assert.equal(
      await readIdempotency(request, schoolB.id, "student.create"),
      null,
    );
    assert.equal(
      await readIdempotency(request, schoolA.id, "guardian.create"),
      null,
    );
  } finally {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA.id, schoolB.id] } },
    });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
