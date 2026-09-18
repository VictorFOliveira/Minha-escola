import { OnboardingWizard } from "@/components/onboarding-wizard";
import { requireRole } from "@/lib/session";

export default async function OnboardingPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="dashboard-content">
      <OnboardingWizard />
    </div>
  );
}
