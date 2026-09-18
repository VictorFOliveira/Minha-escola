import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/session";

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["STUDENT"]);

  return (
    <PortalShell user={session} type="student">
      {children}
    </PortalShell>
  );
}
