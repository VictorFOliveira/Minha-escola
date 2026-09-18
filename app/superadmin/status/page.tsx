import { PlatformStatus } from "@/components/platform-status";
import { requirePlatformSession } from "@/lib/platform-session";

export default async function PlatformStatusPage() {
  await requirePlatformSession();

  return (
    <main className="superadmin-page">
      <div className="superadmin-dashboard">
        <PlatformStatus />
      </div>
    </main>
  );
}
