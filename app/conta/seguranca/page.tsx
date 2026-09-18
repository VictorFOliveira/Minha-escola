import { SecurityCenter } from "@/components/security-center";
import { requireSession } from "@/lib/session";

export default async function AccountSecurityPage() {
  await requireSession();

  return (
    <main className="account-security-page">
      <SecurityCenter />
    </main>
  );
}
