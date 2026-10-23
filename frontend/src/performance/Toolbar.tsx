import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { perfApi } from "./api";
import { useAlertWatcher, useCurrentPersonId } from "./hooks";
import type { Person } from "./types";

/** Seletor "Eu sou" + contador de alertas, mostrado no cabeçalho em todas as páginas. */
export function PerformanceToolbar() {
  const alerts = useAlertWatcher();
  const [me, setMe] = useCurrentPersonId();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    perfApi.people
      .list()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);

  const relevant = me ? alerts.filter((a) => a.ownerId === me) : alerts;
  const critical = relevant.filter((a) => a.severity === "CRITICAL").length;
  const warning = relevant.filter((a) => a.severity === "WARNING").length;

  return (
    <div className="toolbar">
      <label className="inline-label hint">
        Eu sou
        <select value={me} onChange={(e) => setMe(e.target.value)}>
          <option value="">—</option>
          {people
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
        </select>
      </label>
      <Link
        to="/performance/alertas"
        className={`alert-bell ${critical ? "has-critical" : warning ? "has-warning" : ""}`}
        title={me ? "Os meus alertas (críticos / atenção)" : "Alertas (críticos / atenção)"}
      >
        🔔 {critical}
        <span className="hint"> / {warning}</span>
      </Link>
    </div>
  );
}
