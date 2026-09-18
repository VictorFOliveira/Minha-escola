import { requireRole } from "@/lib/session";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN", "FINANCE"]);
  return children;
}
