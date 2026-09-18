import { RecordsManager } from "@/components/records-manager";
import { requireRole } from "@/lib/session";

export default async function GuardiansPage() {
  await requireRole(["ADMIN", "SECRETARY"]);

  return (
    <div className="dashboard-content">
      <RecordsManager kind="guardians" />
    </div>
  );
}
