import { prisma } from "@/lib/prisma";

export async function assertStudentLimit(schoolId: string) {
  const subscription = await prisma.schoolSubscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });

  if (!subscription?.plan.maxStudents) return;

  const count = await prisma.student.count({
    where: {
      schoolId,
      status: "ACTIVE",
    },
  });

  if (count >= subscription.plan.maxStudents) {
    throw new Error(
      "Limite de alunos do plano atingido (" +
        subscription.plan.maxStudents +
        ").",
    );
  }
}

export async function assertUserLimit(schoolId: string) {
  const subscription = await prisma.schoolSubscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });

  if (!subscription?.plan.maxUsers) return;

  const count = await prisma.user.count({
    where: {
      schoolId,
      active: true,
    },
  });

  if (count >= subscription.plan.maxUsers) {
    throw new Error(
      "Limite de usuários do plano atingido (" +
        subscription.plan.maxUsers +
        ").",
    );
  }
}
