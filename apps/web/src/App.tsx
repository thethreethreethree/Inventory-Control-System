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
    learnTl:
      "Buod sa isang tingin: on-hand balances (galing sa ledger), mga pending na approval, at mga transfer na naka-transit.",
  },
  {
    to: "/items",
    label: "Items",
    learn:
      "The item master — every product with its category, unit and current on-hand. Search and filter here.",
    learnTl:
      "Listahan ng lahat ng items — bawat produkto, kategorya, unit at kasalukuyang stock. Mag-search at mag-filter dito.",
  },
  {
    to: "/movements",
    label: "Movements",
    learn:
      "Record stock movements: receipts, issues, waste, breakage, comps. Every change is logged to the immutable ledger.",
    learnTl:
      "I-record ang galaw ng stock: receipt, issue, waste, breakage, comp. Lahat ng pagbabago ay nakatala sa ledger na 'di na mababago.",
  },
  {
    to: "/transfers",
    label: "Transfers",
    learn:
      "Move stock between venues. The sender ships it and the receiver confirms — so nothing goes missing in between.",
    learnTl:
      "Ilipat ang stock sa ibang lokasyon. Ipapadala ng nagbigay at ico-confirm ng tatanggap — para walang mawala sa daan.",
  },
  {
    to: "/counts",
    label: "Counts",
    learn:
      "Run a stocktake. Enter what you physically count; the system compares it to the theoretical figure and flags the variance.",
    learnTl:
      "Mag-stocktake. Ilagay ang aktwal na nabilang; ihahambing ito ng sistema sa nasa records at ipapakita ang variance.",
  },
  {
    to: "/adjustments",
    label: "Adjustments",
    learn:
      "Approve or reject stock corrections raised by counts. The approver must be a different person than who raised it.",
    learnTl:
      "I-approve o i-reject ang mga pagwawasto ng stock mula sa counts. Dapat ibang tao ang nag-approve kaysa sa nag-request.",
  },
  {
    to: "/purchasing",
    label: "Purchasing",
    learn:
      "Suppliers, purchase orders, receiving goods, and invoices with a 3-way match (ordered vs received vs billed).",
    learnTl:
      "Mga supplier, purchase order, pagtanggap ng goods, at invoice na may 3-way match (na-order vs natanggap vs siningil).",
  },
  {
    to: "/recipes",
    label: "Recipes & Sales",
    learn:
      "Define drink recipes and ingest sales — selling a drink automatically depletes its ingredients.",
    learnTl:
      "Mag-set ng recipe ng inumin at mag-import ng sales — kapag may benta, automatic na nababawas ang sangkap.",
  },
  {
    to: "/periods",
    label: "Periods",
    learn: "Open and lock accounting periods. Locking a period blocks any backdated movement into it.",
    learnTl:
      "Magbukas at mag-lock ng accounting period. Kapag naka-lock, 'di na pwedeng mag-backdate ng entry dito.",
  },
  {
    to: "/reports",
    label: "Reports",
    learn:
      "Valuation, activity, shrinkage/variance, reorder alerts and expiring lots — the daily/weekly/monthly audit views.",
    learnTl:
      "Valuation, activity, shrinkage/variance, reorder alerts at malapit nang mag-expire — ang daily/weekly/monthly audit views.",
  },
  {
    to: "/settings",
    label: "Settings",
    learn: "Configure the business, accuracy guards, this learning mode, locations and categories.",
    learnTl:
      "I-configure ang business, accuracy guards, ang learning mode na ito, mga lokasyon at kategorya.",
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
              data-learn-tl={n.learnTl}
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
        data-learn-tl="Built-in calculator sa bawat page: i-convert ang packs papuntang base units (cases/bottles/mL), kuwentahin ang value at margin, o ang variance ng stocktake."
      >
        🧮
      </button>
      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
      <LearnLayer />
    </div>
  );
}
