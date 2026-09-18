import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureOperationalError } from "@/lib/observability";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function trackJob<T>(
  jobName: string,
  action: () => Promise<T>,
) {
  const run = await prisma.systemJobRun.create({
    data: { jobName, status: "RUNNING" },
  });

  try {
    const result = await action();

    await prisma.systemJobRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        result: json(result),
      },
    });

    return result;
  } catch (error) {
    await prisma.systemJobRun
      .update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : "Unknown job error",
        },
      })
      .catch(() => null);

    await captureOperationalError(error, {
      jobName,
      jobRunId: run.id,
    });

    throw error;
  }
}
