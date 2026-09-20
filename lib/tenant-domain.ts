import crypto from "node:crypto";
import { resolveCname } from "node:dns/promises";
import { prisma } from "@/lib/prisma";

export function normalizeDomain(value: string | null | undefined) {
  let domain = String(value || "").trim().toLowerCase();
  if (!domain) return "";
  try {
    if (domain.includes("://")) domain = new URL(domain).hostname;
    else domain = domain.split("/")[0].split(":")[0];
  } catch {}
  return domain.replace(/\.$/, "");
}

function appHost() {
  try {
    return normalizeDomain(process.env.APP_URL ? new URL(process.env.APP_URL).hostname : "");
  } catch {
    return "";
  }
}

export function domainConfig() {
  const baseDomain = normalizeDomain(
    process.env.MINHA_ESCOLA_BASE_DOMAIN || "escola.cactustecnologia.com.br",
  );
  const customCname = normalizeDomain(
    process.env.MINHA_ESCOLA_CUSTOM_CNAME || `custom.${baseDomain}`,
  );
  return { baseDomain, customCname };
}

export function slugifyDomainPart(value: string) {
  return String(value || "escola")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "escola";
}

export function isValidDomain(value: string) {
  const domain = normalizeDomain(value);
  return (
    domain.length <= 253 &&
    domain.includes(".") &&
    !/^\d+(?:\.\d+){3}$/.test(domain) &&
    domain.split(".").every((part) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part),
    )
  );
}

export async function listSchoolDomains(schoolId: string) {
  return prisma.schoolDomain.findMany({
    where: { schoolId },
    orderBy: [{ isPrimary: "desc" }, { type: "asc" }, { createdAt: "asc" }],
  });
}

export async function ensureDefaultSchoolDomain(
  schoolId: string,
  schoolName: string,
  schoolSlug?: string | null,
) {
  const existing = await prisma.schoolDomain.findFirst({
    where: { schoolId, type: "CACTUS" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const { baseDomain } = domainConfig();
  const root = slugifyDomainPart(schoolSlug || schoolName);

  for (let index = 0; index < 50; index += 1) {
    const suffix = index ? `-${index + 1}` : "";
    const prefix = root.slice(0, Math.max(1, 48 - suffix.length)) + suffix;
    const domain = `${prefix}.${baseDomain}`;

    try {
      return await prisma.$transaction(async (tx) => {
        const primaryCount = await tx.schoolDomain.count({
          where: { schoolId, isPrimary: true },
        });

        return tx.schoolDomain.create({
          data: {
            schoolId,
            domain,
            type: "CACTUS",
            verified: true,
            isPrimary: primaryCount === 0,
            verifiedAt: new Date(),
          },
        });
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }

  throw new Error("Não foi possível reservar um subdomínio Cactus para a escola.");
}

export async function createCustomSchoolDomain(schoolId: string, value: string) {
  const domain = normalizeDomain(value);
  const { baseDomain } = domainConfig();

  if (
    !isValidDomain(domain) ||
    domain === baseDomain ||
    domain.endsWith(`.${baseDomain}`)
  ) {
    throw Object.assign(new Error("Domínio personalizado inválido."), {
      status: 400,
    });
  }

  try {
    return await prisma.schoolDomain.create({
      data: {
        schoolId,
        domain,
        type: "CUSTOM",
        verificationToken: crypto.randomBytes(18).toString("hex"),
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw Object.assign(new Error("Este domínio já está vinculado a outra escola."), {
        status: 409,
      });
    }
    throw error;
  }
}

export async function verifyCustomSchoolDomain(schoolId: string, id: string) {
  const row = await prisma.schoolDomain.findFirst({
    where: { id, schoolId, type: "CUSTOM" },
  });
  if (!row) {
    throw Object.assign(new Error("Domínio não encontrado."), { status: 404 });
  }

  const { customCname } = domainConfig();
  let records: string[] = [];
  try {
    records = await resolveCname(row.domain);
  } catch {}

  const normalizedRecords = records.map(normalizeDomain);
  if (!normalizedRecords.includes(customCname)) {
    return {
      verified: false,
      domain: row.domain,
      expectedCname: customCname,
      records: normalizedRecords,
    };
  }

  const domain = await prisma.schoolDomain.update({
    where: { id: row.id },
    data: { verified: true, verifiedAt: new Date() },
  });

  return { verified: true, domain, expectedCname: customCname, records: normalizedRecords };
}

export async function makePrimarySchoolDomain(schoolId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.schoolDomain.findFirst({
      where: { id, schoolId, verified: true },
    });
    if (!target) {
      throw Object.assign(new Error("Domínio verificado não encontrado."), {
        status: 404,
      });
    }

    await tx.schoolDomain.updateMany({
      where: { schoolId, isPrimary: true },
      data: { isPrimary: false },
    });

    return tx.schoolDomain.update({
      where: { id: target.id },
      data: { isPrimary: true },
    });
  });
}

export async function deleteCustomSchoolDomain(schoolId: string, id: string) {
  const target = await prisma.schoolDomain.findFirst({
    where: { id, schoolId, type: "CUSTOM" },
  });
  if (!target) {
    throw Object.assign(new Error("Domínio não encontrado."), { status: 404 });
  }
  if (target.isPrimary) {
    throw Object.assign(
      new Error("Defina outro domínio como principal antes de remover este."),
      { status: 409 },
    );
  }

  await prisma.schoolDomain.delete({ where: { id: target.id } });
}

export async function schoolIdForHost(hostValue: string | null | undefined) {
  const host = normalizeDomain(hostValue);
  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === appHost()
  ) {
    return null;
  }

  const row = await prisma.schoolDomain.findFirst({
    where: { domain: host, verified: true },
    select: { schoolId: true },
  });
  return row?.schoolId || null;
}

export async function assertRequestSchoolHost(
  request: Request,
  schoolId: string,
) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const resolved = await schoolIdForHost(host);
  return !resolved || resolved === schoolId;
}
