import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import { Dashboard } from "./pages/Dashboard";
import { Guests } from "./pages/Guests";
import { Reservations } from "./pages/Reservations";
import { Rooms } from "./pages/Rooms";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>🏨 Hospedaria</h1>
        <nav>
          <NavLink to="/" end>
            Painel
          </NavLink>
          <NavLink to="/reservas">Reservas</NavLink>
          <NavLink to="/quartos">Quartos</NavLink>
          <NavLink to="/hospedes">Hóspedes</NavLink>
        </nav>
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reservas" element={<Reservations />} />
          <Route path="/quartos" element={<Rooms />} />
          <Route path="/hospedes" element={<Guests />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
