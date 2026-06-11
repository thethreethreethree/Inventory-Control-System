import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useActingUser } from "./lib/actingUser";
import { Brand } from "./components/Brand";
import { Calculator } from "./components/Calculator";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/items", label: "Items" },
  { to: "/movements", label: "Movements" },
  { to: "/transfers", label: "Transfers" },
  { to: "/counts", label: "Counts" },
  { to: "/adjustments", label: "Adjustments" },
  { to: "/purchasing", label: "Purchasing" },
  { to: "/recipes", label: "Recipes & Sales" },
  { to: "/periods", label: "Periods" },
  { to: "/reports", label: "Reports" },
];

export function App() {
  const [db, setDb] = useState<"up" | "down" | "…">("…");
  const [calcOpen, setCalcOpen] = useState(false);
  const { user, logout } = useActingUser();

  useEffect(() => {
    const tick = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((h: { db?: string }) => setDb(h.db === "up" ? "up" : "down"))
        .catch(() => setDb("down"));
    void tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand />
        <nav>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? "nav active" : "nav")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="acting-as">
          <span className="acting-label">Signed in as</span>
          <div className="user-name">{user?.name}</div>
          <button className="btn ghost sm block" onClick={logout}>
            Sign out
          </button>
        </div>
        <div className="sidebar-foot">
          <span className={`dot ${db === "up" ? "ok" : db === "down" ? "bad" : ""}`} />
          API {db === "…" ? "checking…" : db}
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>

      <button
        className="calc-fab"
        onClick={() => setCalcOpen((o) => !o)}
        title="Calculator"
        aria-label="Calculator"
      >
        🧮
      </button>
      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
    </div>
  );
}
