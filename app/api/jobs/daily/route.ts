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

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") || "";
  return Boolean(secret) && auth === "Bearer " + secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

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

  return NextResponse.json({
    ok: true,
    expiredTrials: expiredTrials.length,
    overdueNotifications,
    dueSoonNotifications,
    platformInvoicesIssued,
    suspendedPlatformTenants,
  });
}
