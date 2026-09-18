import { ClassesManager } from "@/components/classes-manager";
import { requireRole } from "@/lib/session";

export default async function ClassesPage() {
  const session = await requireRole(["ADMIN", "SECRETARY", "TEACHER"]);

  return (
    <div className="dashboard-content">
      <ClassesManager canEdit={session.role === "ADMIN" || session.role === "SECRETARY"} />
    </div>
  );
}
