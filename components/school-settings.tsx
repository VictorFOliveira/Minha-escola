"use client";

import { FormEvent, useEffect, useState } from "react";

type School = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export function SchoolSettings() {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/school", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "Não foi possível carregar a escola.");
          return;
        }
        setSchool(data.school);
      } catch {
        setError("Não foi possível conectar ao servidor.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      ["name", "document", "email", "phone", "address", "city", "state", "zipCode"].map((key) => [
        key,
        String(form.get(key) || ""),
      ]),
    );

    try {
      const response = await fetch("/api/school", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Não foi possível salvar.");
        return;
      }

      setSchool(data.school);
      setMessage("Dados da instituição atualizados.");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-state">Carregando instituição...</div>;
  if (!school) return <div className="form-alert form-alert--error">{error || "Escola não encontrada."}</div>;

  return (
    <div className="school-settings">
      <div className="page-heading">
        <div>
          <span className="eyebrow">INSTITUIÇÃO</span>
          <h2>Dados da escola</h2>
          <p>Informações usadas em documentos, contatos e configurações do SaaS.</p>
        </div>
      </div>

      {error ? <div className="form-alert form-alert--error">{error}</div> : null}
      {message ? <div className="form-alert">{message}</div> : null}

      <section className="panel">
        <form className="school-form" onSubmit={save}>
          <label>
            Nome da escola
            <input name="name" required defaultValue={school.name} />
          </label>
          <label>
            CNPJ / documento
            <input name="document" defaultValue={school.document || ""} />
          </label>
          <label>
            E-mail institucional
            <input name="email" type="email" defaultValue={school.email || ""} />
          </label>
          <label>
            Telefone
            <input name="phone" defaultValue={school.phone || ""} />
          </label>
          <label className="school-field--wide">
            Endereço
            <input name="address" defaultValue={school.address || ""} />
          </label>
          <label>
            Cidade
            <input name="city" defaultValue={school.city || ""} />
          </label>
          <label>
            Estado
            <input name="state" maxLength={2} defaultValue={school.state || ""} />
          </label>
          <label>
            CEP
            <input name="zipCode" defaultValue={school.zipCode || ""} />
          </label>

          <div className="school-form-actions">
            <button className="button button--primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar dados da escola"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
