"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível entrar.");
        return;
      }

      if (data.mfaRequired && data.challengeToken) {
        sessionStorage.setItem(
          "mfaChallenge",
          JSON.stringify({
            challengeToken: data.challengeToken,
            mfaMode: data.mfaMode,
            platform: false,
          }),
        );
        window.location.href = "/mfa";
        return;
      }

      window.location.href = data.homePath || "/dashboard";
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        E-mail
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@escola.com.br"
          autoComplete="email"
          required
        />
      </label>

      <label>
        <span className="field-label-row">
          Senha
          <a href="/forgot-password">Esqueci minha senha</a>
        </span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Sua senha"
          autoComplete="current-password"
          required
        />
      </label>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      <button className="button button--primary auth-submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar na Minha Escola"}
      </button>
    </form>
  );
}
