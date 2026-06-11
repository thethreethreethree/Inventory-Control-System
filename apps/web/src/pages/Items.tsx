import { useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import {
  Badge,
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
  statusTone,
} from "../components/ui";

const BASE_UNITS = ["each", "ml", "g", "L", "kg", "bottle"];
const ITEM_TYPES = ["discrete", "bulk_liquid", "ingredient", "sold_recipe"];

export function Items() {
  const { data, loading, error, reload } = useAsync(() => api.items());
  const cats = useAsync(() => api.categories());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const blank = { sku: "", name: "", itemType: "discrete", baseUnitCode: "each", categoryId: "" };
  const [f, setF] = useState(blank);
  const [addErr, setAddErr] = useState<string | null>(null);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setAddErr(null);
    try {
      await api.createItem({
        sku: f.sku,
        name: f.name,
        itemType: f.itemType,
        baseUnitCode: f.baseUnitCode,
        categoryId: f.categoryId || undefined,
      });
      setF(blank);
      setShowAdd(false);
      await reload();
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : String(e));
    }
  }

  const categories = useMemo(
    () => [...new Set((data ?? []).map((i) => i.category).filter(Boolean) as string[])].sort(),
    [data],
  );

  const filtered = (data ?? []).filter((i) => {
    const matchesQ =
      !q ||
      i.name.toLowerCase().includes(q.toLowerCase()) ||
      i.sku.toLowerCase().includes(q.toLowerCase());
    return matchesQ && (!cat || i.category === cat);
  });

  return (
    <>
      <PageHeader
        title="Items"
        learn="Browse the full item master. Use search and the category filter to find any product and see its current on-hand. Admins can add new items here."
        subtitle={`Item master — ${data?.length ?? 0} items`}
        actions={
          <Button variant="ghost" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Cancel" : "+ New item"}
          </Button>
        }
      />
      <ErrorBanner error={addErr ?? error} />

      {showAdd && (
        <Card title="New item">
          <form onSubmit={addItem}>
            <div className="form-row">
              <Field label="SKU">
                <Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} required />
              </Field>
              <Field label="Name">
                <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Type">
                <Select value={f.itemType} onChange={(e) => setF({ ...f, itemType: e.target.value })}>
                  {ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Base unit">
                <Select
                  value={f.baseUnitCode}
                  onChange={(e) => setF({ ...f, baseUnitCode: e.target.value })}
                >
                  {BASE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Category">
                <Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                  <option value="">(none)</option>
                  {(cats.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="form-row" style={{ marginBottom: "0.75rem" }}>
          <Field label="Search">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or SKU…" />
          </Field>
          <Field label="Category">
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Type</th>
                <th className="num">On hand</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td>{i.sku}</td>
                  <td>{i.name}</td>
                  <td>{i.category ?? "—"}</td>
                  <td className="muted">{i.itemType}</td>
                  <td className="num">{fmt(i.on_hand)}</td>
                  <td>{i.unit ?? "—"}</td>
                  <td>
                    <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <EmptyRow cols={7} text="No matching items." />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
