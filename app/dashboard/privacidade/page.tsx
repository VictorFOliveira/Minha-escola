import { PrivacyManager } from "@/components/privacy-manager";
import { requireRole } from "@/lib/session";

export default async function PrivacyPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <PrivacyManager />
    </div>
  );
}
