"use client";

import { FormEvent, useState } from "react";

export function PlatformLoginForm() {
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError("");

    try {
      const response = await fetch("/api/platform/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível entrar.");
        return;
      }

      window.location.href = data.homePath || "/superadmin";
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="platform-login-form" onSubmit={submit}>
      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      <label>
        E-mail
        <input name="email" type="email" required autoComplete="username" />
      </label>
      <label>
        Senha
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <button className="button button--primary" disabled={working}>
        {working ? "Entrando..." : "Entrar no Superadmin"}
      </button>
    </form>
  );
}
