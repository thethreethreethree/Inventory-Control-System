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

export function Periods() {
  const { userId } = useActingUser();
  const periods = useAsync(() => api.periods());
  const [type, setType] = useState("monthly");
  const [startsAt, setStarts] = useState("");
  const [endsAt, setEnds] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.createPeriod({
        type,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setStarts("");
      setEnds("");
      await periods.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function close(id: string) {
    setErr(null);
    try {
      await api.closePeriod(id, { closedByUserId: userId, lock: true });
      await periods.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Periods"
        learn={`Periods — opening and locking the books

To open a period: pick its type (daily, weekly, monthly) and the start and end dates, then Create. This simply marks out a window of time.

Once that window has been counted and checked, click "Close & lock". Locking blocks any new or back-dated entry from landing inside that window.

In plain terms: it freezes a finished period so the audited numbers can't be quietly changed later.`}
        learnTl={`Periods — pagbubukas at pag-lock ng libro

Para magbukas: piliin ang type (daily, weekly, monthly) at ang start at end na petsa, tapos Create. Minamarkahan lang nito ang isang window ng panahon.

Kapag nabilang at na-tsek na ang window na iyon, i-click ang "Close & lock". Hinaharangan ng lock ang bago o back-dated na entry sa loob noon.

Sa madaling salita: pinipirmi nito ang tapos nang period para hindi mababago nang palihim ang na-audit na numero.`}
        subtitle="Locking a period blocks any backdated movement into its window."
      />
      <ErrorBanner error={err ?? periods.error} />

      <Card title="Open a period">
        <form onSubmit={create}>
          <div className="form-row">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="monthly">monthly</option>
              </Select>
            </Field>
            <Field label="Starts">
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStarts(e.target.value)}
                required
              />
            </Field>
            <Field label="Ends">
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEnds(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Create
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Periods">
        {periods.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Type</th>
                <th>Window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(periods.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.type}</td>
                  <td className="muted">
                    {new Date(p.startsAt).toLocaleDateString()} –{" "}
                    {new Date(p.endsAt).toLocaleDateString()}
                  </td>
                  <td>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="num">
                    {p.status === "open" && (
                      <Button variant="danger" className="sm" onClick={() => close(p.id)}>
                        Close &amp; lock
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {periods.data && periods.data.length === 0 && <EmptyRow cols={4} />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
