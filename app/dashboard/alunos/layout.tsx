import { requireRole } from "@/lib/session";

export default async function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN", "SECRETARY"]);
  return children;
}
