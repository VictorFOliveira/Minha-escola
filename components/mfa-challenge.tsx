"use client";

import { FormEvent, useEffect, useState } from "react";

type StoredChallenge = {
  challengeToken: string;
  mfaMode: "SETUP" | "VERIFY";
  platform: boolean;
};

export function MfaChallenge({ platform }: { platform: boolean }) {
  const [challenge, setChallenge] = useState<StoredChallenge | null>(null);
  const [setup, setSetup] = useState<{
    qrDataUrl: string;
    secret: string;
    email: string;
  } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [homePath, setHomePath] = useState(
    platform ? "/superadmin" : "/dashboard",
  );
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("mfaChallenge");

    if (!raw) {
      window.location.href = platform ? "/superadmin/login" : "/login";
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredChallenge;

      if (parsed.platform !== platform) {
        throw new Error("invalid");
      }

      setChallenge(parsed);

      if (parsed.mfaMode === "SETUP") {
        void loadSetup(parsed);
      }
    } catch {
      sessionStorage.removeItem("mfaChallenge");
      window.location.href = platform ? "/superadmin/login" : "/login";
    }
  }, [platform]);

  async function loadSetup(current: StoredChallenge) {
    setWorking(true);
    setError("");

    try {
      const response = await fetch(
        platform
          ? "/api/platform/auth/mfa/setup"
          : "/api/auth/mfa/setup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeToken: current.challengeToken,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível preparar o MFA.");
        return;
      }

      setSetup(data);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") || "").trim();

    setWorking(true);
    setError("");

    try {
      const response = await fetch(
        platform
          ? "/api/platform/auth/mfa/verify"
          : "/api/auth/mfa/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeToken: challenge.challengeToken,
            code,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Código inválido.");
        return;
      }

      sessionStorage.removeItem("mfaChallenge");
      setHomePath(data.homePath || homePath);

      if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length) {
        setRecoveryCodes(data.recoveryCodes);
        return;
      }

      window.location.href = data.homePath || homePath;
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  if (recoveryCodes.length) {
    return (
      <div className="mfa-recovery-panel" role="status">
        <span className="eyebrow">CÓDIGOS DE RECUPERAÇÃO</span>
        <h2>Guarde estes códigos em local seguro</h2>
        <p>
          Cada código funciona uma única vez caso você perca acesso ao
          autenticador. Eles não serão exibidos novamente.
        </p>
        <div className="mfa-recovery-grid">
          {recoveryCodes.map((code) => (
            <code key={code}>{code}</code>
          ))}
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(recoveryCodes.join("\n"))
              .catch(() => null);
          }}
        >
          Copiar códigos
        </button>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            window.location.href = homePath;
          }}
        >
          Já guardei. Continuar
        </button>
      </div>
    );
  }

  return (
    <div className="mfa-challenge">
      <span className="eyebrow">
        {challenge?.mfaMode === "SETUP"
          ? "CONFIGURAÇÃO OBRIGATÓRIA"
          : "VERIFICAÇÃO EM DUAS ETAPAS"}
      </span>

      <h2>
        {challenge?.mfaMode === "SETUP"
          ? "Proteja sua conta com autenticador"
          : "Digite o código do autenticador"}
      </h2>

      {challenge?.mfaMode === "SETUP" ? (
        <>
          <p>
            Escaneie o QR no Google Authenticator, Microsoft Authenticator,
            1Password ou outro aplicativo TOTP compatível.
          </p>

          {setup ? (
            <div className="mfa-setup-box">
              <img
                src={setup.qrDataUrl}
                alt="QR Code para configurar autenticação em duas etapas"
                width={260}
                height={260}
              />
              <div>
                <small>Conta</small>
                <strong>{setup.email}</strong>
                <small>Chave manual</small>
                <code>{setup.secret}</code>
              </div>
            </div>
          ) : (
            <div className="loading-state">
              {working ? "Gerando QR..." : "Preparando MFA..."}
            </div>
          )}
        </>
      ) : (
        <p>
          Use o código de 6 dígitos do aplicativo. Também é possível usar um
          código de recuperação.
        </p>
      )}

      <form className="auth-form" onSubmit={verify}>
        <label>
          Código
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000 ou código de recuperação"
            required
            autoFocus
          />
        </label>

        {error ? (
          <div className="form-alert form-alert--error" role="alert">
            {error}
          </div>
        ) : null}

        <button
          className="button button--primary auth-submit"
          disabled={working || !challenge || (challenge.mfaMode === "SETUP" && !setup)}
        >
          {working ? "Verificando..." : "Confirmar acesso"}
        </button>
      </form>
    </div>
  );
}
