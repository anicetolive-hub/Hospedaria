import { lazy, Suspense } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/context";
import { LoginPage } from "./auth/LoginPage";
import { DEMO } from "./demo/flag";
import { Dashboard } from "./pages/Dashboard";
import { Guests } from "./pages/Guests";
import { Alerts } from "./pages/performance/Alerts";
import { Kpis } from "./pages/performance/Kpis";
import { Objectives } from "./pages/performance/Objectives";
import { PerformanceDashboard } from "./pages/performance/PerformanceDashboard";
import { ProjectsTasks } from "./pages/performance/ProjectsTasks";
import { Team } from "./pages/performance/Team";
import { Reservations } from "./pages/Reservations";
import { Rooms } from "./pages/Rooms";
import { PerformanceToolbar } from "./performance/Toolbar";

// Só existe no build de demonstração (comparação literal para o build normal o eliminar)
const DemoBanner =
  import.meta.env.VITE_DEMO === "true" ? lazy(() => import("./demo/DemoBanner").then((m) => ({ default: m.DemoBanner }))) : null;

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/** Mostra o ecrã de login até existir uma sessão válida. */
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <p className="hint" style={{ padding: "2rem" }}>Carregando...</p>;
  if (!user) return <LoginPage />;
  return <Shell />;
}

function Shell() {
  return (
    <div className="app-shell">
      {DemoBanner && (
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
      )}
      <header className="app-header">
        <h1>{DEMO ? "Performance" : "🏨 Hospedaria"}</h1>
        <nav>
          {!DEMO && (
            <div className="nav-group">
              <NavLink to="/" end>
                Painel
              </NavLink>
              <NavLink to="/reservas">Reservas</NavLink>
              <NavLink to="/quartos">Quartos</NavLink>
              <NavLink to="/hospedes">Hóspedes</NavLink>
            </div>
          )}
          <div className="nav-group">
            {!DEMO && <span className="nav-group-label">Performance</span>}
            <NavLink to="/performance" end>
              Visão geral
            </NavLink>
            <NavLink to="/performance/objetivos">Objetivos</NavLink>
            <NavLink to="/performance/kpis">KPIs</NavLink>
            <NavLink to="/performance/projetos">Projetos e tarefas</NavLink>
            <NavLink to="/performance/equipa">Equipa</NavLink>
            <NavLink to="/performance/alertas">Alertas</NavLink>
          </div>
        </nav>
        <PerformanceToolbar />
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={DEMO ? <Navigate to="/performance" replace /> : <Dashboard />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/quartos" element={<Rooms />} />
          <Route path="/hospedes" element={<Guests />} />
          <Route path="/performance" element={<PerformanceDashboard />} />
          <Route path="/performance/objetivos" element={<Objectives />} />
          <Route path="/performance/kpis" element={<Kpis />} />
          <Route path="/performance/projetos" element={<ProjectsTasks />} />
          <Route path="/performance/equipa" element={<Team />} />
          <Route path="/performance/alertas" element={<Alerts />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
