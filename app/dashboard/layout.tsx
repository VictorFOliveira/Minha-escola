import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  if (session.role === "STUDENT") redirect("/portal/aluno");
  if (session.role === "GUARDIAN") redirect("/portal/responsavel");

  return <DashboardShell user={session}>{children}</DashboardShell>;
}
