"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  APP_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AppRole,
} from "@/lib/permissions";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível carregar os usuários.");
        return;
      }

      setUsers(data.users);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || ""),
    };

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível cadastrar o usuário.");
        return;
      }

      event.currentTarget.reset();
      setShowForm(false);
      await loadUsers();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, changes: Partial<Pick<UserItem, "active" | "role">>) {
    setError("");

    try {
      const response = await fetch("/api/users/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível alterar o usuário.");
        return;
      }

      setUsers((current) =>
        current.map((user) => (user.id === id ? { ...user, ...data.user } : user)),
      );
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  return (
    <div className="user-management">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRAÇÃO</span>
          <h2>Usuários e acessos</h2>
          <p>Controle quem entra no sistema e quais módulos cada pessoa pode acessar.</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => setShowForm((value) => !value)}
        >
          {showForm ? "Fechar" : "+ Novo usuário"}
        </button>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}

      {showForm ? (
        <section className="panel user-create-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NOVO ACESSO</span>
              <h2>Cadastrar usuário</h2>
            </div>
          </div>

          <form className="user-form" onSubmit={createUser}>
            <label>
              Nome
              <input name="name" required placeholder="Nome completo" />
            </label>
            <label>
              E-mail
              <input name="email" type="email" required placeholder="usuario@escola.com.br" />
            </label>
            <label>
              Senha inicial
              <input name="password" type="password" minLength={8} required />
            </label>
            <label>
              Perfil
              <select name="role" defaultValue="TEACHER" required>
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </label>
            <button className="button button--primary" disabled={saving}>
              {saving ? "Cadastrando..." : "Criar usuário"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="role-grid">
        {APP_ROLES.map((role) => (
          <article className="role-card" key={role}>
            <strong>{ROLE_LABELS[role]}</strong>
            <p>{ROLE_DESCRIPTIONS[role]}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ACESSOS DA ESCOLA</span>
            <h2>{users.length} usuários</h2>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Carregando usuários...</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Último acesso</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name-cell">
                        <span className="avatar avatar--small">
                          {user.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                        </span>
                        <span>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        className="table-select"
                        value={user.role}
                        onChange={(event) =>
                          void updateUser(user.id, { role: event.target.value as AppRole })
                        }
                      >
                        {APP_ROLES.map((role) => (
                          <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={user.active ? "status-chip status-chip--success" : "status-chip status-chip--warning"}>
                        {user.active ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td>
                      {user.lastLoginAt
                        ? new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(user.lastLoginAt))
                        : "Nunca"}
                    </td>
                    <td>
                      <button
                        className="inline-action"
                        type="button"
                        onClick={() => void updateUser(user.id, { active: !user.active })}
                      >
                        {user.active ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
