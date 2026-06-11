import { useMemo, useState } from "react";
import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import {
  Badge,
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

export function Items() {
  const { data, loading, error } = useAsync(() => api.items());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const categories = useMemo(
    () => [...new Set((data ?? []).map((i) => i.category).filter(Boolean) as string[])].sort(),
    [data],
  );

  const filtered = (data ?? []).filter((i) => {
    const matchesQ =
      !q ||
      i.name.toLowerCase().includes(q.toLowerCase()) ||
      i.sku.toLowerCase().includes(q.toLowerCase());
    const matchesCat = !cat || i.category === cat;
    return matchesQ && matchesCat;
  });

  return (
    <>
      <PageHeader
        title="Items"
        subtitle={`Item master — ${data?.length ?? 0} items`}
      />
      <ErrorBanner error={error} />

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
