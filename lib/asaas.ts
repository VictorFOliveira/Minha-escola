type AsaasError = {
  errors?: Array<{ code?: string; description?: string }>;
};

export type AsaasCustomer = {
  id: string;
  name?: string;
};

export type AsaasPayment = {
  id: string;
  status?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  billingType?: string;
  value?: number;
  netValue?: number;
  dueDate?: string;
};

export type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

type AsaasList<T> = {
  data?: T[];
  totalCount?: number;
};

function getAsaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  const environment =
    process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";

  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada.");
  }

  return {
    apiKey,
    environment,
    baseUrl:
      environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3",
  };
}

export function isAsaasConfigured() {
  return Boolean(
    process.env.ASAAS_API_KEY?.trim() &&
      process.env.ASAAS_WEBHOOK_TOKEN?.trim(),
  );
}

async function asaasRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getAsaasConfig();

  const response = await fetch(config.baseUrl + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MinhaEscola/0.8 (Next.js; " + config.environment + ")",
      access_token: config.apiKey,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T & AsaasError;

  if (!response.ok) {
    const description =
      data.errors?.map((item) => item.description).filter(Boolean).join("; ") ||
      "Erro na integração com o Asaas.";
    throw new Error(description);
  }

  return data;
}

export async function createAsaasCustomer(input: {
  name: string;
  cpfCnpj: string;
  mobilePhone?: string | null;
  email?: string | null;
  externalReference: string;
}) {
  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      mobilePhone: input.mobilePhone || undefined,
      email: input.email || undefined,
      externalReference: input.externalReference,
      notificationDisabled: false,
    }),
  });
}

export async function createAsaasPayment(input: {
  customer: string;
  billingType: "PIX" | "BOLETO" | "UNDEFINED";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}) {
  return asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    }),
  });
}

export async function getAsaasPixQrCode(paymentId: string) {
  return asaasRequest<AsaasPixQrCode>(
    "/payments/" + encodeURIComponent(paymentId) + "/pixQrCode",
    { method: "GET" },
  );
}


export async function findAsaasCustomerByExternalReference(
  externalReference: string,
) {
  const result = await asaasRequest<AsaasList<AsaasCustomer>>(
    "/customers?externalReference=" +
      encodeURIComponent(externalReference) +
      "&limit=1",
    { method: "GET" },
  );

  return result.data?.[0] || null;
}

export async function findAsaasPaymentByExternalReference(
  externalReference: string,
) {
  const result = await asaasRequest<AsaasList<AsaasPayment>>(
    "/payments?externalReference=" +
      encodeURIComponent(externalReference) +
      "&limit=1",
    { method: "GET" },
  );

  return result.data?.[0] || null;
}
