import { requireRole } from "@/lib/session";

export default async function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN", "SECRETARY", "TEACHER"]);
  return children;
}
