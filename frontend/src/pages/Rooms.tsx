import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { ROOM_STATUS_LABEL, type Room, type TuyaCommand } from "../types";

const emptyForm = {
  number: "",
  name: "",
  floor: "",
  tuyaDeviceId: "",
  checkinCode: "switch_1",
  checkinValue: "true",
  checkoutCode: "switch_1",
  checkoutValue: "false",
};

function parseValue(raw: string): TuyaCommand["value"] {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

export function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; message: string; ok: boolean } | null>(null);

  function reload() {
    api.rooms.list().then(setRooms);
  }

  useEffect(reload, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.rooms.create({
        number: form.number,
        name: form.name || undefined,
        floor: form.floor || undefined,
        tuyaDeviceId: form.tuyaDeviceId || undefined,
        tuyaCheckinCommands: form.checkinCode ? [{ code: form.checkinCode, value: parseValue(form.checkinValue) }] : [],
        tuyaCheckoutCommands: form.checkoutCode
          ? [{ code: form.checkoutCode, value: parseValue(form.checkoutValue) }]
          : [],
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar quarto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este quarto?")) return;
    await api.rooms.remove(id);
    reload();
  }

  async function handleTestTuya(room: Room) {
    setTestingId(room.id);
    setTestResult(null);
    try {
      await api.rooms.testTuya(room.id);
      setTestResult({ id: room.id, ok: true, message: "Dispositivo respondeu com sucesso." });
    } catch (err) {
      setTestResult({ id: room.id, ok: false, message: err instanceof ApiError ? err.message : "Falha no teste" });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Quartos</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            Número
            <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          </label>
          <label className="form-field">
            Nome/Tipo
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="form-field">
            Andar
            <input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </label>
          <label className="form-field">
            ID do dispositivo Tuya
            <input
              placeholder="ex: bf1234567890abcdef"
              value={form.tuyaDeviceId}
              onChange={(e) => setForm({ ...form, tuyaDeviceId: e.target.value })}
            />
          </label>
        </div>

        <p className="hint">
          Comando enviado ao dispositivo no <strong>check-in</strong> (ex: destrancar fechadura / ligar energia):
        </p>
        <div className="form-grid">
          <label className="form-field">
            Código DP
            <input value={form.checkinCode} onChange={(e) => setForm({ ...form, checkinCode: e.target.value })} />
          </label>
          <label className="form-field">
            Valor
            <input value={form.checkinValue} onChange={(e) => setForm({ ...form, checkinValue: e.target.value })} />
          </label>
        </div>

        <p className="hint">
          Comando enviado no <strong>check-out</strong> (ex: trancar / desligar):
        </p>
        <div className="form-grid">
          <label className="form-field">
            Código DP
            <input value={form.checkoutCode} onChange={(e) => setForm({ ...form, checkoutCode: e.target.value })} />
          </label>
          <label className="form-field">
            Valor
            <input value={form.checkoutValue} onChange={(e) => setForm({ ...form, checkoutValue: e.target.value })} />
          </label>
        </div>

        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Adicionar quarto"}
        </button>
      </form>

      <div className="card-grid">
        {rooms.map((room) => (
          <div className="card" key={room.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>
                {room.number} {room.name ? `· ${room.name}` : ""}
              </strong>
              <span className={`badge ${room.status}`}>{ROOM_STATUS_LABEL[room.status]}</span>
            </div>
            <p className="tuya-tag">
              🔌 {room.tuyaDeviceId ? `Dispositivo: ${room.tuyaDeviceId}` : "Sem dispositivo Tuya vinculado"}
            </p>
            <div className="actions">
              {room.tuyaDeviceId && (
                <button className="btn secondary" disabled={testingId === room.id} onClick={() => handleTestTuya(room)}>
                  {testingId === room.id ? "Testando..." : "Testar dispositivo"}
                </button>
              )}
              <button className="btn danger" onClick={() => handleDelete(room.id)}>
                Remover
              </button>
            </div>
            {testResult?.id === room.id && (
              <p className="hint" style={{ color: testResult.ok ? "var(--green)" : "var(--red)" }}>
                {testResult.message}
              </p>
            )}
          </div>
        ))}
        {rooms.length === 0 && <p className="hint">Nenhum quarto cadastrado.</p>}
      </div>
    </div>
  );
}
