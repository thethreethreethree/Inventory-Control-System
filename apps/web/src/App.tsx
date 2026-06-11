import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useActingUser } from "./lib/actingUser";

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
];

export function App() {
  const [db, setDb] = useState<"up" | "down" | "…">("…");
  const { users, userId, setUserId } = useActingUser();

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
        <div className="brand">
          Inventory<span>Control</span>
        </div>
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
          <span className="acting-label">Acting as</span>
          <select
            className="acting-select"
            value={userId ?? ""}
            onChange={(e) => setUserId(e.target.value)}
          >
            {users.length === 0 && <option value="">…</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sidebar-foot">
          <span className={`dot ${db === "up" ? "ok" : db === "down" ? "bad" : ""}`} />
          API {db === "…" ? "checking…" : db}
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
