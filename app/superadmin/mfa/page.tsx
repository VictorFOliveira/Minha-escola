import { MfaChallenge } from "@/components/mfa-challenge";

export default function PlatformMfaPage() {
  return (
    <main className="platform-login-page">
      <section className="platform-login-card">
        <span className="brand-mark">ME</span>
        <MfaChallenge platform />
      </section>
    </main>
  );
}
