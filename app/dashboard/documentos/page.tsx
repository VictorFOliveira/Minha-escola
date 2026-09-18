import { DocumentManager } from "@/components/document-manager";
import { requireRole } from "@/lib/session";

export default async function DocumentsPage() {
  const session = await requireRole([
    "ADMIN",
    "COORDINATOR",
    "SECRETARY",
    "FINANCE",
  ]);

  return (
    <div className="dashboard-content">
      <DocumentManager role={session.role} />
    </div>
  );
}
