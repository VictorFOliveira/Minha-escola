"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [debugToken, setDebugToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setDebugToken("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      setMessage(data.message || data.error || "Solicitação processada.");
      if (data.debugToken) setDebugToken(data.debugToken);
    } catch {
      setMessage("Não foi possível processar a solicitação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        E-mail da sua conta
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@escola.com.br"
          autoComplete="email"
          required
        />
      </label>

      {message ? <div className="form-alert">{message}</div> : null}

      {debugToken ? (
        <a
          className="button button--secondary"
          href={"/reset-password?token=" + encodeURIComponent(debugToken)}
        >
          Abrir link de redefinição (desenvolvimento)
        </a>
      ) : null}

      <button className="button button--primary auth-submit" disabled={loading}>
        {loading ? "Processando..." : "Gerar recuperação"}
      </button>
    </form>
  );
}
