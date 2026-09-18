import { AssessmentManager } from "@/components/assessment-manager";
import { requireRole } from "@/lib/session";

export default async function AssessmentsPage() {
  await requireRole(["ADMIN", "COORDINATOR", "TEACHER"]);

  return (
    <div className="dashboard-content">
      <AssessmentManager />
    </div>
  );
}
