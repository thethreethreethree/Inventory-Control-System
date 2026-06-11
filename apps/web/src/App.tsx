import { useEffect, useState } from "react";
import { getJSON, type Balance, type Health, type Item } from "./api";

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getJSON<Health>("/health"),
      getJSON<Balance[]>("/balances"),
      getJSON<Item[]>("/items"),
    ])
      .then(([h, b, i]) => {
        setHealth(h);
        setBalances(b);
        setItems(i);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <h1>Inventory Control System</h1>
        <span className={`badge ${health?.db === "up" ? "ok" : "bad"}`}>
          {health ? `API ${health.status} · DB ${health.db}` : "connecting…"}
        </span>
      </header>

      {error && (
        <p className="error">
          Could not reach the API ({error}). Is it running on :4000? Try{" "}
          <code>pnpm dev:api</code>.
        </p>
      )}

      <section>
        <h2>On-hand (derived from the ledger)</h2>
        <p className="hint">
          These numbers are <code>SUM(movements.base_qty)</code> — not a stored value.
          That is the core accountability guarantee.
        </p>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Location</th>
              <th className="num">On hand</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={`${b.sku}-${b.location}`}>
                <td>{b.sku}</td>
                <td>{b.item}</td>
                <td>{b.location}</td>
                <td className="num">{b.on_hand}</td>
                <td>{b.unit}</td>
              </tr>
            ))}
            {balances.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="muted">
                  No movements yet — run <code>pnpm db:seed</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Item master</h2>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Brand</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.sku}</td>
                <td>{it.name}</td>
                <td>{it.brand ?? "—"}</td>
                <td>{it.itemType}</td>
                <td>{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
