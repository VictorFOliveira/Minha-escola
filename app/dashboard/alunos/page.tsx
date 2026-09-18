import { RecordsManager } from "@/components/records-manager";
import { requireRole } from "@/lib/session";

export default async function StudentsPage() {
  await requireRole(["ADMIN", "SECRETARY"]);

  return (
    <div className="dashboard-content">
      <RecordsManager kind="students" />
    </div>
  );
}
