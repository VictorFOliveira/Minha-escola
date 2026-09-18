import { SchoolSettings } from "@/components/school-settings";
import { requireRole } from "@/lib/session";

export default async function SchoolPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <SchoolSettings />
    </div>
  );
}
