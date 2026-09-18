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

  const school = await prisma.school.upsert({
    where: { document: "DEMO-MINHA-ESCOLA" },
    update: { name: schoolName },
    create: {
      name: schoolName,
      document: "DEMO-MINHA-ESCOLA",
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

  console.log("Seed concluído.");
  console.log("Escola:", school.name);
  console.log("Administrador:", email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
