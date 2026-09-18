import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/session";

export default async function GuardianPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["GUARDIAN"]);

  return (
    <PortalShell user={session} type="guardian">
      {children}
    </PortalShell>
  );
}
