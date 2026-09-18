import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageConfigured } from "@/lib/storage";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) &&
    request.headers.get("authorization") === "Bearer " + secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const [dbStats, recentJobs, failedJobs24h, pendingUploads] =
      await Promise.all([
        prisma.$queryRaw<
          Array<{
            databaseBytes: bigint;
            activeConnections: number;
          }>
        >`
          SELECT
            pg_database_size(current_database()) AS "databaseBytes",
            COUNT(*)::int AS "activeConnections"
          FROM pg_stat_activity
          WHERE datname = current_database()
        `,
        prisma.systemJobRun.findMany({
          orderBy: { startedAt: "desc" },
          take: 10,
          select: {
            id: true,
            jobName: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            error: true,
          },
        }),
        prisma.systemJobRun.count({
          where: {
            status: "FAILED",
            startedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.fileAsset.count({
          where: { status: "PENDING" },
        }),
      ]);

    const stats = dbStats[0];

    return NextResponse.json(
      {
        service: "minha-escola",
        version: process.env.APP_VERSION || "1.0.0",
        environment:
          process.env.SENTRY_ENVIRONMENT ||
          process.env.NODE_ENV ||
          "unknown",
        database: {
          status: "ok",
          bytes: Number(stats?.databaseBytes || 0),
          activeConnections: stats?.activeConnections || 0,
        },
        integrations: {
          storage: storageConfigured(),
          malwareScan:
            process.env.REQUIRE_MALWARE_SCAN !== "false" &&
            Boolean(process.env.MALWARE_SCAN_WEBHOOK_URL),
          email: Boolean(process.env.RESEND_API_KEY),
          whatsapp: Boolean(
            process.env.WHATSAPP_ACCESS_TOKEN &&
              process.env.WHATSAPP_PHONE_NUMBER_ID,
          ),
          schoolAsaas: Boolean(process.env.ASAAS_API_KEY),
          platformAsaas: Boolean(process.env.PLATFORM_ASAAS_API_KEY),
          sentry: Boolean(process.env.SENTRY_DSN),
        },
        jobs: {
          failedLast24h: failedJobs24h,
          recent: recentJobs,
        },
        uploads: {
          pending: pendingUploads,
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        service: "minha-escola",
        status: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
