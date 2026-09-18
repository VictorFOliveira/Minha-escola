import { UserManagement } from "@/components/user-management";
import { requireRole } from "@/lib/session";

export default async function UsersPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <UserManagement />
    </div>
  );
}
