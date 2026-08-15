import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { AutomationOutcome, Guest, Reservation, Room } from "../types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const emptyForm = { guestId: "", roomId: "", checkinDate: todayIso(), checkoutDate: tomorrowIso(), notes: "" };

function automationSummary(reservation: Reservation): { text: string; ok: boolean } | null {
  if (!reservation.lastAutomationResult) return null;
  try {
    const parsed = JSON.parse(reservation.lastAutomationResult) as AutomationOutcome & { phase: string };
    if (!parsed.attempted) return { text: "Automação: sem dispositivo configurado", ok: true };
    if (parsed.success) return { text: `Automação (${parsed.phase}): OK`, ok: true };
    return { text: `Automação (${parsed.phase}) falhou: ${parsed.error}`, ok: false };
  } catch {
    return null;
  }
}

export function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    api.reservations.list().then(setReservations);
  }

  useEffect(() => {
    reload();
    api.guests.list().then(setGuests);
    api.rooms.list().then(setRooms);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.reservations.create({
        guestId: form.guestId,
        roomId: form.roomId,
        checkinDate: form.checkinDate,
        checkoutDate: form.checkoutDate,
        notes: form.notes || undefined,
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar reserva");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const { automation } = await api.reservations.checkIn(id);
      const outcome = automation as AutomationOutcome;
      if (outcome.attempted && !outcome.success) {
        setError(
          `Check-in confirmado, mas a automação Tuya falhou: ${outcome.error}. Libere o hóspede manualmente e verifique o dispositivo.`,
        );
      }
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao fazer check-in");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckOut(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.reservations.checkOut(id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao fazer check-out");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancelar esta reserva?")) return;
    await api.reservations.cancel(id);
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <h2>Reservas</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            Hóspede
            <select required value={form.guestId} onChange={(e) => setForm({ ...form, guestId: e.target.value })}>
              <option value="">Selecione...</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Quarto
            <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">Selecione...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} {r.name ? `· ${r.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Check-in previsto
            <input
              type="date"
              required
              value={form.checkinDate}
              onChange={(e) => setForm({ ...form, checkinDate: e.target.value })}
            />
          </label>
          <label className="form-field">
            Check-out previsto
            <input
              type="date"
              required
              value={form.checkoutDate}
              onChange={(e) => setForm({ ...form, checkoutDate: e.target.value })}
            />
          </label>
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Criar reserva"}
        </button>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Hóspede</th>
              <th>Quarto</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Status</th>
              <th>Automação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const automation = automationSummary(r);
              return (
                <tr key={r.id}>
                  <td>{r.guest.fullName}</td>
                  <td>{r.room.number}</td>
                  <td>{new Date(r.checkinDate).toLocaleDateString("pt-PT")}</td>
                  <td>{new Date(r.checkoutDate).toLocaleDateString("pt-PT")}</td>
                  <td>
                    <span className={`badge ${r.status}`}>{r.status}</span>
                  </td>
                  <td>
                    {automation ? (
                      <span className="hint" style={{ color: automation.ok ? "var(--green)" : "var(--red)" }}>
                        {automation.text}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      {r.status === "BOOKED" && (
                        <button className="btn" disabled={busyId === r.id} onClick={() => handleCheckIn(r.id)}>
                          {busyId === r.id ? "Processando..." : "Check-in"}
                        </button>
                      )}
                      {r.status === "CHECKED_IN" && (
                        <button className="btn secondary" disabled={busyId === r.id} onClick={() => handleCheckOut(r.id)}>
                          {busyId === r.id ? "Processando..." : "Check-out"}
                        </button>
                      )}
                      {r.status === "BOOKED" && (
                        <button className="btn danger" onClick={() => handleCancel(r.id)}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={7} className="hint">
                  Nenhuma reserva cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
