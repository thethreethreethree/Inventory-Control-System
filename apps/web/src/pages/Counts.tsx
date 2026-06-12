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
  statusTone,
} from "../components/ui";

const UNITS = ["each", "ml", "g", "bottle", "case"];

export function Counts() {
  const { userId } = useActingUser();
  const items = useAsync(() => api.items());
  const locations = useAsync(() => api.locations());
  const counts = useAsync(() => api.counts());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useAsync(
    () => (selectedId ? api.count(selectedId) : Promise.resolve(null)),
    [selectedId],
  );
  const [err, setErr] = useState<string | null>(null);

  const itemName = (id: string) => items.data?.find((i) => i.id === id)?.sku ?? id.slice(0, 8);

  // create count
  const [locationId, setLocationId] = useState("");
  const [scope, setScope] = useState("daily_spot");
  async function createCount(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const c = await api.createCount({ locationId, scope, blind: true, startedByUserId: userId });
      await counts.reload();
      setSelectedId(c.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // add a counted line
  const [lineItem, setLineItem] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [lineUnit, setLineUnit] = useState("each");
  async function addLine(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setErr(null);
    try {
      await api.submitCountLines(selectedId, {
        lines: [{ itemId: lineItem, countedQty: Number(lineQty), unitCode: lineUnit }],
      });
      setLineQty("");
      await detail.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function post() {
    if (!selectedId) return;
    setErr(null);
    try {
      await api.postCount(selectedId, { postedByUserId: userId });
      await Promise.all([detail.reload(), counts.reload()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const current = detail.data;
  const counting = current?.status === "counting";

  return (
    <>
      <PageHeader
        title="Counts"
        learn="Start a count, key in what you physically have, then Post — the difference vs the system's figure becomes a variance to approve. The count itself never changes stock."
        learnTl="Magsimula ng count, ilagay ang aktwal na bilang, tapos i-Post — ang pagkakaiba sa records ay magiging variance na aaprubahan. Hindi binabago ng count mismo ang stock."
        subtitle="A blind stocktake. Posting compares counted vs theoretical and raises adjustments for the variance — it never changes stock directly."
      />
      <ErrorBanner error={err ?? counts.error} />

      <div className="grid2">
        <div>
          <Card title="New count">
            <form onSubmit={createCount}>
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
              <Field label="Scope">
                <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="daily_spot">daily spot</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly_full">monthly full</option>
                </Select>
              </Field>
              <Button type="submit">Start count</Button>
            </form>
          </Card>

          <Card title="Count sessions">
            {counts.loading ? (
              <Loading />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Status</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {(counts.data ?? []).map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{ cursor: "pointer", background: c.id === selectedId ? "#eff6ff" : undefined }}
                    >
                      <td>{c.scope}</td>
                      <td>
                        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="muted">{new Date(c.startedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {counts.data && counts.data.length === 0 && <EmptyRow cols={3} />}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div>
          <Card
            title={current ? `Count — ${current.status}` : "Select a count"}
            actions={
              counting ? (
                <Button onClick={post}>Post count</Button>
              ) : undefined
            }
          >
            {!current ? (
              <p className="muted">Pick a count session, or start a new one.</p>
            ) : (
              <>
                {counting && (
                  <form onSubmit={addLine} style={{ marginBottom: "1rem" }}>
                    <div className="form-row">
                      <Field label="Item">
                        <Select value={lineItem} onChange={(e) => setLineItem(e.target.value)} required>
                          <option value="">Select…</option>
                          {(items.data ?? []).map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.sku}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Counted">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={lineQty}
                          onChange={(e) => setLineQty(e.target.value)}
                          required
                        />
                      </Field>
                      <Field label="Unit">
                        <Select value={lineUnit} onChange={(e) => setLineUnit(e.target.value)}>
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button type="submit" variant="ghost">
                        Add
                      </Button>
                    </div>
                  </form>
                )}

                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Counted</th>
                      <th className="num">Expected</th>
                      <th className="num">Variance</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{itemName(l.itemId)}</td>
                        <td className="num">{fmt(l.countedBaseQty)}</td>
                        <td className="num">{l.expectedBaseQty ? fmt(l.expectedBaseQty) : "—"}</td>
                        <td className="num">
                          {l.varianceBase != null ? (
                            <Badge tone={Number(l.varianceBase) === 0 ? "ok" : "bad"}>
                              {fmt(l.varianceBase)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {l.withinTolerance != null &&
                            (l.withinTolerance ? (
                              <Badge tone="ok">in tol</Badge>
                            ) : (
                              <Badge tone="warn">over</Badge>
                            ))}
                        </td>
                      </tr>
                    ))}
                    {current.lines.length === 0 && <EmptyRow cols={5} text="No lines counted yet." />}
                  </tbody>
                </table>
                {current.status === "posted" && (
                  <p className="hint" style={{ marginTop: "0.75rem" }}>
                    Variances raised adjustments — approve them on the Adjustments page (as a
                    different user) to correct stock.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
