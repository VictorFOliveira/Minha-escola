import { CommunicationManager } from "@/components/communication-manager";
import { requireRole } from "@/lib/session";

export default async function CommunicationPage() {
  const session = await requireRole([
    "ADMIN",
    "COORDINATOR",
    "SECRETARY",
    "TEACHER",
    "FINANCE",
  ]);

  return (
    <div className="dashboard-content">
      <CommunicationManager
        role={session.role}
        canConfigure={session.role === "ADMIN"}
      />
    </div>
  );
}
