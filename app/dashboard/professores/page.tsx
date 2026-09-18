import { RecordsManager } from "@/components/records-manager";
import { requireRole } from "@/lib/session";

export default async function TeachersPage() {
  await requireRole(["ADMIN", "SECRETARY"]);

  return (
    <div className="dashboard-content">
      <RecordsManager kind="teachers" />
    </div>
  );
}
