import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/security-crypto";
import { hasSchoolFeature } from "@/lib/features";

export type ApiScope =
  | "students:read"
  | "enrollments:read"
  | "finance:read"
  | "attendance:read";

export const API_SCOPES: ApiScope[] = [
  "students:read",
  "enrollments:read",
  "finance:read",
  "attendance:read",
];

export async function authenticateApi(
  request: Request,
  requiredScope: ApiScope,
) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) return null;

  const secretHash = hashSecret("api-key:" + token);

  const credential = await prisma.apiCredential.findUnique({
    where: { secretHash },
    include: {
      school: {
        include: { subscription: true },
      },
    },
  });

  if (
    !credential ||
    !credential.active ||
    (credential.expiresAt && credential.expiresAt <= new Date()) ||
    !credential.scopes.includes(requiredScope) ||
    ["SUSPENDED", "CANCELLED"].includes(
      credential.school.lifecycleStatus,
    ) ||
    ["SUSPENDED", "CANCELLED"].includes(
      credential.school.subscription?.status || "",
    ) ||
    !(await hasSchoolFeature(credential.schoolId, "api"))
  ) {
    return null;
  }

  await prisma.apiCredential
    .update({
      where: { id: credential.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => null);

  return {
    credentialId: credential.id,
    schoolId: credential.schoolId,
    schoolName: credential.school.name,
    scopes: credential.scopes,
  };
}
