import { EnrollmentManager } from "@/components/enrollment-manager";
import { requireRole } from "@/lib/session";

export default async function EnrollmentsPage() {
  await requireRole(["ADMIN", "SECRETARY"]);

  return (
    <div className="dashboard-content">
      <EnrollmentManager />
    </div>
  );
}
