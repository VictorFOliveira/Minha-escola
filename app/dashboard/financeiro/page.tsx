import { FinanceManager } from "@/components/finance-manager";
import { requireRole } from "@/lib/session";

export default async function FinancePage() {
  const session = await requireRole(["ADMIN", "FINANCE"]);

  return (
    <div className="dashboard-content">
      <FinanceManager canConfigure={session.role === "ADMIN"} />
    </div>
  );
}
