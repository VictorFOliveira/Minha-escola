import { AuditManager } from "@/components/audit-manager";
import { requireRole } from "@/lib/session";

export default async function AuditPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <AuditManager />
    </div>
  );
}
