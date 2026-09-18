import { prisma } from "@/lib/prisma";
import { auditSystemAction } from "@/lib/audit";

type AsaasCustomer = { id: string };
type AsaasPayment = {
  id: string;
  status?: string;
  invoiceUrl?: string;
};

type AsaasList<T> = {
  data?: T[];
};

function platformAsaasConfig() {
  const apiKey = process.env.PLATFORM_ASAAS_API_KEY?.trim();
  const environment =
    process.env.PLATFORM_ASAAS_ENVIRONMENT === "production"
      ? "production"
      : "sandbox";

  if (!apiKey) {
    throw new Error("PLATFORM_ASAAS_API_KEY não configurada.");
  }

  return {
    apiKey,
    baseUrl:
      environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3",
  };
}

async function requestAsaas<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = platformAsaasConfig();

  const response = await fetch(config.baseUrl + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MinhaEscola-Platform/1.0",
      access_token: config.apiKey,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T & {
    errors?: Array<{ description?: string }>;
  };

  if (!response.ok) {
    const detail =
      data.errors
        ?.map((item) => item.description)
        .filter(Boolean)
        .join("; ") || "Erro na cobrança da plataforma.";

    throw new Error(detail);
  }

  return data;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function findCustomer(externalReference: string) {
  const result = await requestAsaas<AsaasList<AsaasCustomer>>(
    "/customers?externalReference=" +
      encodeURIComponent(externalReference) +
      "&limit=1",
  );

  return result.data?.[0] || null;
}

async function createCustomer(input: {
  schoolId: string;
  name: string;
  document: string;
  email: string;
  phone?: string | null;
}) {
  return requestAsaas<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.document,
      email: input.email,
      mobilePhone: input.phone || undefined,
      externalReference: input.schoolId,
      notificationDisabled: false,
    }),
  });
}

async function findPayment(externalReference: string) {
  const result = await requestAsaas<AsaasList<AsaasPayment>>(
    "/payments?externalReference=" +
      encodeURIComponent(externalReference) +
      "&limit=1",
  );

  return result.data?.[0] || null;
}

async function createPayment(input: {
  customerId: string;
  value: number;
  dueDate: Date;
  description: string;
  externalReference: string;
}) {
  return requestAsaas<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "UNDEFINED",
      value: input.value,
      dueDate: input.dueDate.toISOString().slice(0, 10),
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export function platformAsaasConfigured() {
  return Boolean(
    process.env.PLATFORM_ASAAS_API_KEY?.trim() &&
      process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN?.trim(),
  );
}

export async function issuePlatformInvoice(
  subscriptionId: string,
  options?: { force?: boolean },
) {
  const subscription = await prisma.schoolSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      school: true,
      plan: true,
    },
  });

  if (!subscription) {
    throw new Error("Assinatura não encontrada.");
  }

  if (subscription.provider !== "ASAAS") {
    throw new Error("A assinatura não usa cobrança Asaas da plataforma.");
  }

  if (!platformAsaasConfigured()) {
    throw new Error("Asaas da plataforma não está configurado.");
  }

  if (!subscription.school.document || !subscription.school.email) {
    throw new Error(
      "A escola precisa ter CNPJ/CPF e e-mail institucional para cobrança automática.",
    );
  }

  const now = new Date();
  const scheduledAt =
    subscription.nextBillingAt ||
    subscription.trialEndsAt ||
    subscription.currentPeriodEnd ||
    subscription.startedAt;

  if (!options?.force && scheduledAt > now) {
    return { invoice: null, skipped: true };
  }

  const periodStart = scheduledAt;
  const periodEnd =
    subscription.billingInterval === "ANNUAL"
      ? addYears(periodStart, 1)
      : addMonths(periodStart, 1);

  const amount =
    subscription.billingInterval === "ANNUAL"
      ? Number(
          subscription.plan.annualPrice ??
            Number(subscription.plan.monthlyPrice) * 12,
        )
      : Number(subscription.plan.monthlyPrice);

  let invoice = await prisma.platformInvoice.findUnique({
    where: {
      subscriptionId_periodStart: {
        subscriptionId: subscription.id,
        periodStart,
      },
    },
  });

  if (!invoice) {
    invoice = await prisma.platformInvoice.create({
      data: {
        subscriptionId: subscription.id,
        provider: "ASAAS",
        amount,
        dueDate: addDays(now, 5),
        periodStart,
        periodEnd,
      },
    });
  }

  if (invoice.externalId) {
    return { invoice, skipped: false };
  }

  let customerId = subscription.externalCustomerId;

  if (!customerId) {
    const customer =
      (await findCustomer(subscription.school.id).catch(() => null)) ||
      (await createCustomer({
        schoolId: subscription.school.id,
        name: subscription.school.name,
        document: subscription.school.document,
        email: subscription.school.email,
        phone: subscription.school.phone,
      }));

    customerId = customer.id;
  }

  const externalReference = "platform-invoice:" + invoice.id;
  const payment =
    (await findPayment(externalReference).catch(() => null)) ||
    (await createPayment({
      customerId,
      value: amount,
      dueDate: invoice.dueDate,
      description:
        "Minha Escola - " +
        subscription.plan.name +
        " - " +
        (subscription.billingInterval === "ANNUAL" ? "anual" : "mensal"),
      externalReference,
    }));

  const updated = await prisma.$transaction(async (tx) => {
    const updatedInvoice = await tx.platformInvoice.update({
      where: { id: invoice!.id },
      data: {
        externalId: payment.id,
        invoiceUrl: payment.invoiceUrl || null,
      },
    });

    await tx.schoolSubscription.update({
      where: { id: subscription.id },
      data: {
        externalCustomerId: customerId,
        nextBillingAt: periodEnd,
      },
    });

    return updatedInvoice;
  });

  await auditSystemAction({
    schoolId: subscription.schoolId,
    action: "PLATFORM_INVOICE_ISSUED",
    entityType: "PlatformInvoice",
    entityId: updated.id,
    metadata: {
      amount,
      interval: subscription.billingInterval,
      externalId: payment.id,
    },
  }).catch(() => null);

  return { invoice: updated, skipped: false };
}

export async function suspendOverduePlatformSubscriptions(now = new Date()) {
  const graceDays = Math.max(
    1,
    Number(process.env.PLATFORM_BILLING_GRACE_DAYS || 7),
  );
  const cutoff = addDays(now, -graceDays);

  const overdue = await prisma.platformInvoice.findMany({
    where: {
      status: "OVERDUE",
      dueDate: { lt: cutoff },
      subscription: {
        status: { in: ["PAST_DUE", "ACTIVE", "TRIAL"] },
      },
    },
    include: {
      subscription: true,
    },
  });

  for (const invoice of overdue) {
    await prisma.$transaction([
      prisma.schoolSubscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: "SUSPENDED" },
      }),
      prisma.school.update({
        where: { id: invoice.subscription.schoolId },
        data: { lifecycleStatus: "SUSPENDED" },
      }),
    ]);

    await auditSystemAction({
      schoolId: invoice.subscription.schoolId,
      action: "TENANT_SUSPENDED_FOR_NONPAYMENT",
      entityType: "SchoolSubscription",
      entityId: invoice.subscriptionId,
      metadata: {
        invoiceId: invoice.id,
        graceDays,
      },
    }).catch(() => null);
  }

  return overdue.length;
}
