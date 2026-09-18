import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  notifyDueSoonCharge,
  notifyOverdueCharge,
} from "@/lib/system-communications";
import { auditSystemAction } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";
import {
  issuePlatformInvoice,
  suspendOverduePlatformSubscriptions,
} from "@/lib/platform-billing";
import {
  deleteStoredObject,
  storageConfigured,
} from "@/lib/storage";
import { processCommunicationDeliveries } from "@/lib/communication-delivery";
import { trackJob } from "@/lib/jobs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  return Boolean(secret) && auth === "Bearer " + secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await trackJob("daily-maintenance", async () => {
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const deliveryResult = await processCommunicationDeliveries(200);

  const privacySettings = await prisma.privacySettings.findMany({
    select: {
      schoolId: true,
      auditRetentionDays: true,
    },
  });

  let auditLogsDeleted = 0;

  for (const settings of privacySettings) {
    const cutoff = new Date(
      now.getTime() -
        settings.auditRetentionDays * 24 * 60 * 60 * 1000,
    );

    const deleted = await prisma.auditLog.deleteMany({
      where: {
        schoolId: settings.schoolId,
        createdAt: { lt: cutoff },
      },
    });

    auditLogsDeleted += deleted.count;
  }

  const [expiredIdempotency, expiredPasswordResets] = await Promise.all([
    prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null } },
        ],
      },
    }),
  ]);

  await prisma.securityThrottle.deleteMany({
    where: {
      updatedAt: {
        lt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      },
      OR: [
        { blockedUntil: null },
        { blockedUntil: { lt: now } },
      ],
    },
  });

  const staleUploads = await prisma.fileAsset.findMany({
    where: {
      status: "PENDING",
      createdAt: {
        lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      objectKey: true,
    },
  });

  if (storageConfigured()) {
    for (const asset of staleUploads) {
      await deleteStoredObject(asset.objectKey).catch(() => null);
    }
  }

  if (staleUploads.length) {
    await prisma.fileAsset.deleteMany({
      where: {
        id: { in: staleUploads.map((item) => item.id) },
        status: "PENDING",
      },
    });
  }

  await prisma.authorizationRequest.updateMany({
    where: {
      status: "PENDING",
      communication: {
        expiresAt: { lt: now },
      },
    },
    data: { status: "EXPIRED" },
  });

  const billingSubscriptions = await prisma.schoolSubscription.findMany({
    where: {
      provider: "ASAAS",
      status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
      OR: [
        { nextBillingAt: { lte: now } },
        {
          nextBillingAt: null,
          trialEndsAt: { lte: now },
        },
      ],
    },
    select: { id: true },
  });

  let platformInvoicesIssued = 0;

  for (const subscription of billingSubscriptions) {
    const result = await issuePlatformInvoice(subscription.id).catch(() => null);
    if (result?.invoice) platformInvoicesIssued += 1;
  }

  const suspendedPlatformTenants =
    await suspendOverduePlatformSubscriptions(now);

  const expiredTrials = await prisma.schoolSubscription.findMany({
    where: {
      status: "TRIAL",
      provider: { not: "ASAAS" },
      trialEndsAt: { lt: now },
    },
    select: { id: true, schoolId: true },
  });

  for (const subscription of expiredTrials) {
    await prisma.schoolSubscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE" },
    });

    await auditSystemAction({
      schoolId: subscription.schoolId,
      action: "TRIAL_EXPIRED",
      entityType: "SchoolSubscription",
      entityId: subscription.id,
    }).catch(() => null);
  }

  const schools = await prisma.school.findMany({
    where: {
      lifecycleStatus: { in: ["TRIAL", "ACTIVE"] },
    },
    include: {
      users: {
        where: { role: "ADMIN", active: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  let overdueNotifications = 0;
  let dueSoonNotifications = 0;

  for (const school of schools) {
    const admin = school.users[0];
    if (!admin) continue;

    const session: SessionUser = {
      id: admin.id,
      schoolId: school.id,
      schoolName: school.name,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      enrollmentId: admin.enrollmentId,
      guardianId: admin.guardianId,
      teacherId: admin.teacherId,
    };

    const overdueCandidates = await prisma.charge.findMany({
      where: {
        schoolId: school.id,
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
      },
    });

    for (const charge of overdueCandidates) {
      if (Number(charge.paidAmount) >= Number(charge.amount)) continue;

      await prisma.charge.update({
        where: { id: charge.id },
        data: { status: "OVERDUE" },
      });

      await notifyOverdueCharge({
        session,
        chargeId: charge.id,
      }).catch(() => null);
      overdueNotifications += 1;
    }

    const dueSoonCandidates = await prisma.charge.findMany({
      where: {
        schoolId: school.id,
        status: { in: ["PENDING", "PARTIAL"] },
        dueDate: {
          gte: now,
          lte: inThreeDays,
        },
      },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
      },
    });

    for (const charge of dueSoonCandidates) {
      if (Number(charge.paidAmount) >= Number(charge.amount)) continue;

      await notifyDueSoonCharge({
        session,
        chargeId: charge.id,
      }).catch(() => null);
      dueSoonNotifications += 1;
    }
  }

  return {
    expiredTrials: expiredTrials.length,
    overdueNotifications,
    dueSoonNotifications,
    platformInvoicesIssued,
    suspendedPlatformTenants,
    communicationDeliveries: deliveryResult,
    auditLogsDeleted,
    staleUploadsDeleted: staleUploads.length,
    expiredIdempotencyDeleted: expiredIdempotency.count,
    expiredPasswordResetsDeleted: expiredPasswordResets.count,
  };
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
