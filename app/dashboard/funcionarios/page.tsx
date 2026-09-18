import { RecordsManager } from "@/components/records-manager";
import { requireRole } from "@/lib/session";

export default async function EmployeesPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <RecordsManager kind="employees" />
    </div>
  );
}
