import { prisma } from "@/lib/prisma";

export const SCHOOL_FEATURES = [
  "academic",
  "finance",
  "communication",
  "documents",
  "bulkImport",
  "advancedExports",
  "api",
  "webhooks",
  "whatsapp",
  "supportImpersonation",
] as const;

export type SchoolFeature = (typeof SCHOOL_FEATURES)[number];

const coreDefaults: Record<SchoolFeature, boolean> = {
  academic: true,
  finance: true,
  communication: true,
  documents: true,
  bulkImport: false,
  advancedExports: false,
  api: false,
  webhooks: false,
  whatsapp: false,
  supportImpersonation: false,
};

export async function getSchoolFeatures(schoolId: string) {
  const subscription = await prisma.schoolSubscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  });

  const configured =
    subscription?.plan.features &&
    typeof subscription.plan.features === "object" &&
    !Array.isArray(subscription.plan.features)
      ? (subscription.plan.features as Record<string, unknown>)
      : {};

  return SCHOOL_FEATURES.reduce(
    (acc, feature) => {
      acc[feature] =
        typeof configured[feature] === "boolean"
          ? Boolean(configured[feature])
          : coreDefaults[feature];
      return acc;
    },
    {} as Record<SchoolFeature, boolean>,
  );
}

export async function hasSchoolFeature(
  schoolId: string,
  feature: SchoolFeature,
) {
  const features = await getSchoolFeatures(schoolId);
  return features[feature];
}

export async function assertSchoolFeature(
  schoolId: string,
  feature: SchoolFeature,
) {
  if (!(await hasSchoolFeature(schoolId, feature))) {
    throw new Error(
      "Este recurso não está disponível no plano atual da escola.",
    );
  }
}
