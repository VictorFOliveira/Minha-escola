import { FinanceManager } from "@/components/finance-manager";
import { requireRole } from "@/lib/session";

export default async function FinancePage() {
  await requireRole(["ADMIN", "FINANCE"]);

  return (
    <div className="dashboard-content">
      <FinanceManager />
    </div>
  );
}
