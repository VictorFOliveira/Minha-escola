"use client";

import { FormEvent, useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível alterar a senha.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-success">
        <span>✓</span>
        <h3>Senha alterada</h3>
        <p>Você já pode entrar usando a nova senha.</p>
        <a className="button button--primary" href="/login">Ir para o login</a>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {!token ? (
        <div className="form-alert form-alert--error">
          O link de recuperação está incompleto.
        </div>
      ) : null}

      <label>
        Nova senha
        <input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
      </label>

      <label>
        Confirmar nova senha
        <input type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
      </label>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      <button className="button button--primary auth-submit" disabled={loading || !token}>
        {loading ? "Salvando..." : "Definir nova senha"}
      </button>
    </form>
  );
}
