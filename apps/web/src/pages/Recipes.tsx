import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { useActingUser } from "../lib/actingUser";
import {
  Button,
  Card,
  EmptyRow,
  ErrorBanner,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  fmt,
} from "../components/ui";

const UNITS = ["ml", "each", "g", "bottle", "case"];
type Comp = { itemId: string; qty: string; unitCode: string };

export function Recipes() {
  const { userId } = useActingUser();
  const items = useAsync(() => api.items());
  const locations = useAsync(() => api.locations());
  const recipes = useAsync(() => api.recipes());

  const [err, setErr] = useState<string | null>(null);
  const itemName = (id: string) => items.data?.find((i) => i.id === id)?.sku ?? id.slice(0, 8);

  // create recipe
  const [name, setName] = useState("");
  const [comps, setComps] = useState<Comp[]>([{ itemId: "", qty: "", unitCode: "ml" }]);
  const setComp = (i: number, patch: Partial<Comp>) =>
    setComps((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  async function createRecipe(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createRecipe({
        name,
        components: comps
          .filter((c) => c.itemId && c.qty)
          .map((c) => ({ itemId: c.itemId, qty: Number(c.qty), unitCode: c.unitCode })),
      });
      setName("");
      setComps([{ itemId: "", qty: "", unitCode: "ml" }]);
      await recipes.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // yield
  const [yieldId, setYieldId] = useState<string | null>(null);
  const recYield = useAsync(
    () => (yieldId ? api.recipeYield(yieldId) : Promise.resolve(null)),
    [yieldId],
  );

  // sales ingestion
  const [saleRecipe, setSaleRecipe] = useState("");
  const [saleQty, setSaleQty] = useState("");
  const [saleLoc, setSaleLoc] = useState("");
  const [depletions, setDepletions] = useState<{ itemId: string; baseQty: number }[] | null>(null);
  async function ingest(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setDepletions(null);
    try {
      const r = await api.ingestSales({
        source: "manual",
        locationId: saleLoc,
        importedByUserId: userId,
        lines: [{ recipeId: saleRecipe, qtySold: Number(saleQty) }],
      });
      setDepletions(r.depletions);
      setSaleQty("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Recipes & Sales"
        learn="Build recipes so that ingesting sales automatically subtracts each ingredient from stock — consumption captured without keying every pour."
        subtitle="A recipe maps a sold item to component quantities. Ingesting sales auto-depletes the components — consumption captured without keying every pour."
      />
      <ErrorBanner error={err} />

      <div className="grid2">
        <Card title="New recipe">
          <form onSubmit={createRecipe}>
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gin & Tonic" required />
            </Field>
            <p className="field-label">Components (per serving)</p>
            {comps.map((c, i) => (
              <div className="form-row" key={i} style={{ marginBottom: "0.5rem" }}>
                <Field label="Item">
                  <Select value={c.itemId} onChange={(e) => setComp(i, { itemId: e.target.value })}>
                    <option value="">Select…</option>
                    {(items.data ?? []).map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.sku}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Qty">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={c.qty}
                    onChange={(e) => setComp(i, { qty: e.target.value })}
                  />
                </Field>
                <Field label="Unit">
                  <Select value={c.unitCode} onChange={(e) => setComp(i, { unitCode: e.target.value })}>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ))}
            <div className="row gap">
              <Button
                type="button"
                variant="ghost"
                className="sm"
                onClick={() => setComps((cs) => [...cs, { itemId: "", qty: "", unitCode: "ml" }])}
              >
                + component
              </Button>
              <Button type="submit">Create recipe</Button>
            </div>
          </form>
        </Card>

        <Card title="Ingest sales (auto-deplete)">
          <form onSubmit={ingest}>
            <Field label="Recipe">
              <Select value={saleRecipe} onChange={(e) => setSaleRecipe(e.target.value)} required>
                <option value="">Select…</option>
                {(recipes.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="form-row">
              <Field label="Qty sold">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={saleQty}
                  onChange={(e) => setSaleQty(e.target.value)}
                  required
                />
              </Field>
              <Field label="Location">
                <Select value={saleLoc} onChange={(e) => setSaleLoc(e.target.value)} required>
                  <option value="">Select…</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">Ingest</Button>
            </div>
          </form>
          {depletions && (
            <div className="notice" style={{ marginTop: "0.75rem" }}>
              Depleted:{" "}
              {depletions.map((d) => `${itemName(d.itemId)} −${fmt(d.baseQty)}`).join(", ")}
            </div>
          )}
        </Card>
      </div>

      <Card title="Recipes">
        {recipes.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Yield</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(recipes.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{fmt(r.yieldQty)}</td>
                  <td className="num">
                    <Button variant="ghost" className="sm" onClick={() => setYieldId(r.id)}>
                      Yield
                    </Button>
                  </td>
                </tr>
              ))}
              {recipes.data && recipes.data.length === 0 && <EmptyRow cols={3} />}
            </tbody>
          </table>
        )}
      </Card>

      {recYield.data && (
        <Card title={`Yield — ${recYield.data.recipe}`}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Component</th>
                <th className="num">Per serving</th>
                <th className="num">Servings / stock unit</th>
              </tr>
            </thead>
            <tbody>
              {recYield.data.components.map((c, i) => (
                <tr key={i}>
                  <td>{c.item}</td>
                  <td className="num">{fmt(c.perServingBase)}</td>
                  <td className="num">
                    {c.servingsPerStockUnit != null
                      ? `${fmt(c.servingsPerStockUnit)} / ${c.stockUnit}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
