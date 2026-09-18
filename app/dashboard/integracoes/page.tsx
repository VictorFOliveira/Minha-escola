import { IntegrationManager } from "@/components/integration-manager";
import { requireRole } from "@/lib/session";

export default async function IntegrationsPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <IntegrationManager />
    </div>
  );
}
