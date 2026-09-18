import { TeacherDiaryManager } from "@/components/teacher-diary-manager";
import { requireRole } from "@/lib/session";

export default async function TeacherDiaryPage() {
  await requireRole(["ADMIN", "COORDINATOR", "TEACHER"]);

  return (
    <div className="dashboard-content">
      <TeacherDiaryManager />
    </div>
  );
}
