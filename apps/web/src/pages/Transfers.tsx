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
  statusTone,
} from "../components/ui";

export function Transfers() {
  const { userId } = useActingUser();
  const items = useAsync(() => api.items());
  const locations = useAsync(() => api.locations());
  const transfers = useAsync(() => api.transfers());

  const [fromLocationId, setFrom] = useState("");
  const [toLocationId, setTo] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locName = (id: string) => locations.data?.find((l) => l.id === id)?.name ?? id.slice(0, 8);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.createTransfer({
        fromLocationId,
        toLocationId,
        issuedByUserId: userId ?? undefined,
        lines: [{ itemId, qty: Number(qty) }],
      });
      setQty("");
      await transfers.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(id: string) {
    setErr(null);
    try {
      await api.confirmTransfer(id, { receivedByUserId: userId ?? undefined });
      await transfers.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Stock leaves the source now; the destination is credited only when the receiver confirms."
      />
      <ErrorBanner error={err ?? transfers.error} />

      <Card title="New transfer">
        <form onSubmit={create}>
          <div className="form-row">
            <Field label="From">
              <Select value={fromLocationId} onChange={(e) => setFrom(e.target.value)} required>
                <option value="">Select…</option>
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To">
              <Select value={toLocationId} onChange={(e) => setTo(e.target.value)} required>
                <option value="">Select…</option>
                {(locations.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Item">
              <Select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
                <option value="">Select…</option>
                {(items.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.sku}
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
            <Button type="submit" disabled={busy}>
              Send
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Transfers">
        {transfers.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Issued</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(transfers.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{locName(t.fromLocationId)}</td>
                  <td>{locName(t.toLocationId)}</td>
                  <td>
                    <Badge tone={statusTone(t.status)}>{t.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="muted">{new Date(t.issuedAt).toLocaleString()}</td>
                  <td className="num">
                    {t.status === "in_transit" && (
                      <Button className="sm" onClick={() => confirm(t.id)}>
                        Confirm receipt
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {transfers.data && transfers.data.length === 0 && <EmptyRow cols={5} />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
