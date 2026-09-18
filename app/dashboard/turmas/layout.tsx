import { requireRole } from "@/lib/session";

export default async function ClassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN", "SECRETARY", "TEACHER"]);
  return children;
}
