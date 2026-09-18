import { SecurityCenter } from "@/components/security-center";
import { requirePlatformSession } from "@/lib/platform-session";

export default async function PlatformSecurityPage() {
  await requirePlatformSession();

  return (
    <main className="superadmin-page">
      <div className="superadmin-dashboard">
        <SecurityCenter platform />
      </div>
    </main>
  );
}
