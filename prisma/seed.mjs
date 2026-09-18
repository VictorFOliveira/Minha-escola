import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@minhaescola.local")
    .trim()
    .toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const schoolName = process.env.SEED_SCHOOL_NAME || "Colégio Demonstração";

  if (!password || password.length < 8) {
    throw new Error(
      "Defina SEED_ADMIN_PASSWORD com pelo menos 8 caracteres antes de executar db:seed.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const starter = await prisma.saaSPlan.upsert({
    where: { code: "STARTER" },
    update: {
      name: "Starter",
      monthlyPrice: 199,
      maxStudents: 300,
      maxUsers: 25,
      active: true,
    },
    create: {
      code: "STARTER",
      name: "Starter",
      description: "Plano inicial para escolas de pequeno e médio porte.",
      monthlyPrice: 199,
      annualPrice: 1990,
      maxStudents: 300,
      maxUsers: 25,
      features: {
        academic: true,
        finance: true,
        communication: true,
        documents: true,
      },
    },
  });

  await prisma.saaSPlan.upsert({
    where: { code: "PRO" },
    update: {
      name: "Pro",
      monthlyPrice: 399,
      maxStudents: 1000,
      maxUsers: 80,
      active: true,
    },
    create: {
      code: "PRO",
      name: "Pro",
      description: "Plano ampliado para operações escolares maiores.",
      monthlyPrice: 399,
      annualPrice: 3990,
      maxStudents: 1000,
      maxUsers: 80,
      features: {
        academic: true,
        finance: true,
        communication: true,
        documents: true,
        prioritySupport: true,
      },
    },
  });

  const school = await prisma.school.upsert({
    where: { document: "DEMO-MINHA-ESCOLA" },
    update: {
      name: schoolName,
      slug: "colegio-demonstracao",
      lifecycleStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
    },
    create: {
      name: schoolName,
      slug: "colegio-demonstracao",
      document: "DEMO-MINHA-ESCOLA",
      lifecycleStatus: "ACTIVE",
      onboardingCompletedAt: new Date(),
    },
  });

  await prisma.schoolSubscription.upsert({
    where: { schoolId: school.id },
    update: {
      planId: starter.id,
      status: "ACTIVE",
    },
    create: {
      schoolId: school.id,
      planId: starter.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      name: "Administrador",
      password: passwordHash,
      role: UserRole.ADMIN,
      active: true,
      schoolId: school.id,
    },
    create: {
      schoolId: school.id,
      name: "Administrador",
      email,
      password: passwordHash,
      role: UserRole.ADMIN,
      active: true,
    },
  });

  const platformEmail = process.env.SEED_PLATFORM_ADMIN_EMAIL
    ?.trim()
    .toLowerCase();
  const platformPassword = process.env.SEED_PLATFORM_ADMIN_PASSWORD;

  if (platformEmail && platformPassword && platformPassword.length >= 10) {
    const platformHash = await bcrypt.hash(platformPassword, 12);

    await prisma.platformAdmin.upsert({
      where: { email: platformEmail },
      update: {
        name: "Platform Admin",
        password: platformHash,
        active: true,
      },
      create: {
        name: "Platform Admin",
        email: platformEmail,
        password: platformHash,
      },
    });
  }

  console.log("Seed concluído.");
  console.log("Escola:", school.name);
  console.log("Administrador:", email);
  console.log("Planos SaaS: STARTER e PRO");
  if (platformEmail && platformPassword?.length >= 10) {
    console.log("Superadmin:", platformEmail);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
