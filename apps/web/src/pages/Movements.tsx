import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { useActingUser } from "../lib/actingUser";
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
} from "../components/ui";

const TYPES = ["receipt", "issue", "waste", "breakage", "comp"] as const;

export function Movements() {
  const { userId } = useActingUser();
  const items = useAsync(() => api.items());
  const locations = useAsync(() => api.locations());
  const feed = useAsync(() => api.movements("?limit=25"));

  const [itemId, setItemId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [movementType, setType] = useState<(typeof TYPES)[number]>("issue");
  const [qty, setQty] = useState("");
  const [reasonCode, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.recordMovement({
        itemId,
        locationId,
        qty: Number(qty),
        movementType,
        reasonCode: reasonCode || undefined,
        actorUserId: userId ?? undefined,
      });
      setQty("");
      setReason("");
      await feed.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Movements"
        subtitle="Record a receipt, issue, waste, breakage or comp. The sign is derived from the type."
      />
      <ErrorBanner error={err ?? feed.error} />

      <Card title="Record a movement">
        <form onSubmit={submit}>
          <div className="form-row">
            <Field label="Item">
              <Select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                <option value="">Select…</option>
                {(items.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku} — {i.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                <option value="">Select…</option>
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={movementType} onChange={(e) => setType(e.target.value as never)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qty (base unit)">
              <Input
                type="number"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </Field>
            <Field label="Reason">
              <Input value={reasonCode} onChange={(e) => setReason(e.target.value)} placeholder="optional" />
            </Field>
            <Button type="submit" disabled={busy}>
              Post
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Recent ledger activity">
        {feed.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Item</th>
                <th>Location</th>
                <th className="num">Qty</th>
                <th>Reason</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(feed.data ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="muted">{m.seq}</td>
                  <td>
                    <Badge tone={Number(m.baseQty) >= 0 ? "ok" : "bad"}>{m.type}</Badge>
                  </td>
                  <td>{m.item}</td>
                  <td>{m.location}</td>
                  <td className="num">{fmt(m.baseQty)}</td>
                  <td className="muted">{m.reason ?? "—"}</td>
                  <td className="muted">{new Date(m.occurredAt).toLocaleString()}</td>
                </tr>
              ))}
              {feed.data && feed.data.length === 0 && <EmptyRow cols={7} />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
