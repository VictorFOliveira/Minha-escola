import { prisma } from "@/lib/prisma";
import { storageConfigured } from "@/lib/storage";
import { platformAsaasConfigured } from "@/lib/platform-billing";
import { malwareScannerConfigured } from "@/lib/malware-scan";

export async function getSystemStatus() {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let database = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = false;
  }

  const [
    communicationPending,
    communicationFailed,
    webhookPending,
    webhookFailed,
    scanPending,
    scanFailed,
    overduePlatformInvoices,
    criticalSecurityEvents,
    recentJobs,
  ] = await Promise.all([
    prisma.communicationDelivery.count({
      where: {
        channel: { in: ["EMAIL", "WHATSAPP"] },
        status: "PENDING",
      },
    }),
    prisma.communicationDelivery.count({
      where: {
        channel: { in: ["EMAIL", "WHATSAPP"] },
        status: "FAILED",
        attempts: { gte: 5 },
      },
    }),
    prisma.outgoingWebhookDelivery.count({
      where: { status: "PENDING" },
    }),
    prisma.outgoingWebhookDelivery.count({
      where: {
        status: "FAILED",
        attempts: { gte: 8 },
      },
    }),
    prisma.fileAsset.count({
      where: {
        status: "PENDING",
        scanStatus: "PENDING",
      },
    }),
    prisma.fileAsset.count({
      where: { scanStatus: "FAILED" },
    }),
    prisma.platformInvoice.count({
      where: { status: "OVERDUE" },
    }),
    prisma.securityEvent.count({
      where: {
        severity: "CRITICAL",
        createdAt: { gte: last24Hours },
      },
    }),
    prisma.systemJobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  const lastJobs = ["communications", "daily-maintenance"].map(
    (jobName) => ({
      jobName,
      run: recentJobs.find((run) => run.jobName === jobName) || null,
    }),
  );

  const integrations = {
    storage: storageConfigured(),
    platformAsaas: platformAsaasConfigured(),
    malwareScanner: malwareScannerConfigured(),
    resend: Boolean(
      process.env.RESEND_API_KEY?.trim() &&
        process.env.EMAIL_FROM?.trim(),
    ),
    whatsapp: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
        process.env.WHATSAPP_GRAPH_VERSION?.trim() &&
        process.env.WHATSAPP_TEMPLATE_NAME?.trim(),
    ),
    sentry: Boolean(process.env.SENTRY_DSN?.trim()),
  };

  const queueFailures =
    communicationFailed + webhookFailed + scanFailed;

  const overall =
    !database
      ? "DOWN"
      : queueFailures > 0 || criticalSecurityEvents > 0
        ? "DEGRADED"
        : "OK";

  return {
    overall,
    checkedAt: now,
    database,
    queues: {
      communicationPending,
      communicationFailed,
      webhookPending,
      webhookFailed,
      scanPending,
      scanFailed,
    },
    billing: {
      overduePlatformInvoices,
    },
    security: {
      criticalLast24Hours: criticalSecurityEvents,
    },
    integrations,
    jobs: lastJobs,
  };
}
