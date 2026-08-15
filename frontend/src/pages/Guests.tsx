import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { Guest } from "../types";

const emptyForm = { fullName: "", document: "", phone: "", email: "" };

export function Guests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    api.guests.list().then(setGuests);
  }

  useEffect(reload, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.guests.create(form);
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar hóspede");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este hóspede?")) return;
    await api.guests.remove(id);
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <h2>Hóspedes</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            Nome completo
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>
          <label className="form-field">
            Documento (BI/Passaporte)
            <input required value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </label>
          <label className="form-field">
            Telefone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="form-field">
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Adicionar hóspede"}
        </button>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Documento</th>
              <th>Telefone</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id}>
                <td>{g.fullName}</td>
                <td>{g.document}</td>
                <td>{g.phone ?? "-"}</td>
                <td>{g.email ?? "-"}</td>
                <td>
                  <button className="btn danger" onClick={() => handleDelete(g.id)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={5} className="hint">
                  Nenhum hóspede cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
