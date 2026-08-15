import { useEffect, useState } from "react";
import { api } from "../api";
import type { Reservation, Room } from "../types";

export function Dashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tuya, setTuya] = useState<{ connected: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.rooms.list(), api.reservations.list(), api.tuya.status()])
      .then(([r, res, t]) => {
        setRooms(r);
        setReservations(res);
        setTuya(t);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="hint">Carregando...</p>;

  const available = rooms.filter((r) => r.status === "AVAILABLE").length;
  const occupied = rooms.filter((r) => r.status === "OCCUPIED").length;
  const activeReservations = reservations.filter((r) => r.status === "CHECKED_IN").length;
  const upcoming = reservations.filter((r) => r.status === "BOOKED").length;

  return (
    <div>
      <div className="page-header">
        <h2>Painel</h2>
      </div>

      <div className="card-grid" style={{ marginBottom: "1.2rem" }}>
        <div className="stat">
          <div className="value">{available}</div>
          <div className="label">Quartos disponíveis</div>
        </div>
        <div className="stat">
          <div className="value">{occupied}</div>
          <div className="label">Quartos ocupados</div>
        </div>
        <div className="stat">
          <div className="value">{activeReservations}</div>
          <div className="label">Hóspedes no hotel</div>
        </div>
        <div className="stat">
          <div className="value">{upcoming}</div>
          <div className="label">Reservas por chegar</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Integração Tuya</h3>
        {tuya?.connected ? (
          <p>
            <span className="badge OCCUPIED">Conectado</span> — a API da Tuya Cloud respondeu com sucesso.
          </p>
        ) : (
          <>
            <p>
              <span className="badge MAINTENANCE">Não conectado</span> — verifique as credenciais{" "}
              <code>TUYA_CLIENT_ID</code> / <code>TUYA_CLIENT_SECRET</code> no backend.
            </p>
            {tuya?.error && <p className="hint">Detalhe: {tuya.error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
