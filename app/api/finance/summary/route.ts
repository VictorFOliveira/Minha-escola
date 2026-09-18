import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!["ADMIN", "FINANCE"].includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<
    Array<{
      totalReceived: unknown;
      totalReceivable: unknown;
      open: unknown;
      overdue: unknown;
      overdueGuardians: number;
      charges: number;
    }>
  >`
    SELECT
      COALESCE(SUM("paidAmount"), 0) AS "totalReceived",
      COALESCE(
        SUM(GREATEST("amount" - "paidAmount", 0)),
        0
      ) AS "totalReceivable",
      COALESCE(
        SUM(
          CASE
            WHEN "dueDate" >= NOW()
              AND "amount" - "paidAmount" > 0
            THEN "amount" - "paidAmount"
            ELSE 0
          END
        ),
        0
      ) AS "open",
      COALESCE(
        SUM(
          CASE
            WHEN "dueDate" < NOW()
              AND "amount" - "paidAmount" > 0
            THEN "amount" - "paidAmount"
            ELSE 0
          END
        ),
        0
      ) AS "overdue",
      COUNT(
        DISTINCT CASE
          WHEN "dueDate" < NOW()
            AND "amount" - "paidAmount" > 0
          THEN "guardianId"
          ELSE NULL
        END
      )::int AS "overdueGuardians",
      COUNT(*)::int AS "charges"
    FROM "Charge"
    WHERE
      "schoolId" = ${session.schoolId}
      AND "status" NOT IN ('CANCELLED', 'REFUNDED')
  `;

  const summary = rows[0];

  return NextResponse.json({
    summary: {
      totalReceived: Number(summary?.totalReceived || 0),
      totalReceivable: Number(summary?.totalReceivable || 0),
      open: Number(summary?.open || 0),
      overdue: Number(summary?.overdue || 0),
      overdueGuardians: summary?.overdueGuardians || 0,
      charges: summary?.charges || 0,
    },
  });
}
