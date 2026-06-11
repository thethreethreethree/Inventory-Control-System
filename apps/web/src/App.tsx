import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useActingUser } from "./lib/actingUser";
import { Brand } from "./components/Brand";
import { Calculator } from "./components/Calculator";
import { LearnLayer } from "./lib/learn";

const NAV = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    learn:
      "Your at-a-glance overview: on-hand balances (derived from the ledger), pending approvals and transfers in transit.",
  },
  {
    to: "/items",
    label: "Items",
    learn:
      "The item master — every product with its category, unit and current on-hand. Search and filter here.",
  },
  {
    to: "/movements",
    label: "Movements",
    learn:
      "Record stock movements: receipts, issues, waste, breakage, comps. Every change is logged to the immutable ledger.",
  },
  {
    to: "/transfers",
    label: "Transfers",
    learn:
      "Move stock between venues. The sender ships it and the receiver confirms — so nothing goes missing in between.",
  },
  {
    to: "/counts",
    label: "Counts",
    learn:
      "Run a stocktake. Enter what you physically count; the system compares it to the theoretical figure and flags the variance.",
  },
  {
    to: "/adjustments",
    label: "Adjustments",
    learn:
      "Approve or reject stock corrections raised by counts. The approver must be a different person than who raised it.",
  },
  {
    to: "/purchasing",
    label: "Purchasing",
    learn:
      "Suppliers, purchase orders, receiving goods, and invoices with a 3-way match (ordered vs received vs billed).",
  },
  {
    to: "/recipes",
    label: "Recipes & Sales",
    learn:
      "Define drink recipes and ingest sales — selling a drink automatically depletes its ingredients.",
  },
  {
    to: "/periods",
    label: "Periods",
    learn: "Open and lock accounting periods. Locking a period blocks any backdated movement into it.",
  },
  {
    to: "/reports",
    label: "Reports",
    learn:
      "Valuation, activity, shrinkage/variance, reorder alerts and expiring lots — the daily/weekly/monthly audit views.",
  },
  {
    to: "/settings",
    label: "Settings",
    learn: "Configure the business, accuracy guards, this learning mode, locations and categories.",
  },
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
              data-learn={n.learn}
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
        data-learn="A built-in calculator on every page: convert packs to base units (cases/bottles/mL), work out value & margin, or compute a stocktake variance."
      >
        🧮
      </button>
      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
      <LearnLayer />
    </div>
  );
}
