import { DataOperations } from "@/components/data-operations";
import { requireRole } from "@/lib/session";

export default async function DataPage() {
  const session = await requireRole([
    "ADMIN",
    "COORDINATOR",
    "SECRETARY",
    "FINANCE",
  ]);

  return (
    <div className="dashboard-content">
      <DataOperations role={session.role} />
    </div>
  );
}
