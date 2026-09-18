import { ReportCardManager } from "@/components/report-card-manager";
import { requireRole } from "@/lib/session";

export default async function ReportCardsPage() {
  await requireRole(["ADMIN", "COORDINATOR", "TEACHER"]);

  return (
    <div className="dashboard-content">
      <ReportCardManager />
    </div>
  );
}
