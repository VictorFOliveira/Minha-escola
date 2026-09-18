export type BenefitInput = {
  active: boolean;
  valueType: "PERCENTAGE" | "FIXED";
  value: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDiscount(
  baseAmount: number,
  dueDate: Date,
  benefits: BenefitInput[],
) {
  let discount = 0;

  for (const benefit of benefits) {
    if (!benefit.active) continue;
    if (benefit.startsAt && dueDate < benefit.startsAt) continue;
    if (benefit.endsAt && dueDate > benefit.endsAt) continue;

    if (benefit.valueType === "PERCENTAGE") {
      discount += baseAmount * (benefit.value / 100);
    } else {
      discount += benefit.value;
    }
  }

  return roundMoney(Math.min(baseAmount, Math.max(0, discount)));
}

export function addMonthsPreservingDay(
  initialDate: Date,
  monthsToAdd: number,
  dueDay: number,
) {
  const year = initialDate.getUTCFullYear();
  const month = initialDate.getUTCMonth() + monthsToAdd;
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const day = Math.min(Math.max(1, dueDay), lastDay);

  return new Date(Date.UTC(year, month, day, 12));
}

export function getChargeStatus(input: {
  amount: number;
  paidAmount: number;
  dueDate: Date;
  currentStatus?: string;
}) {
  if (input.currentStatus === "CANCELLED") return "CANCELLED" as const;
  if (input.currentStatus === "REFUNDED") return "REFUNDED" as const;
  if (input.paidAmount >= input.amount) return "PAID" as const;
  if (input.paidAmount > 0) return "PARTIAL" as const;

  const today = new Date();
  const due = new Date(input.dueDate);
  const startToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );

  if (dueDay < startToday) return "OVERDUE" as const;
  return "PENDING" as const;
}
