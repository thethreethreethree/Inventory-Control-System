import { useState } from "react";
import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { useActingUser } from "../lib/actingUser";
import { Badge, Button, Card, EmptyRow, ErrorBanner, Loading, PageHeader, fmt, statusTone } from "../components/ui";

export function Adjustments() {
  const { userId, user } = useActingUser();
  const adjustments = useAsync(() => api.adjustments());
  const items = useAsync(() => api.items());
  const locations = useAsync(() => api.locations());
  const [err, setErr] = useState<string | null>(null);

  const itemName = (id: string) => items.data?.find((i) => i.id === id)?.sku ?? id.slice(0, 8);
  const locName = (id: string) => locations.data?.find((l) => l.id === id)?.name ?? id.slice(0, 8);

  async function review(id: string, action: "approve" | "reject") {
    setErr(null);
    try {
      if (action === "approve") await api.approveAdjustment(id, { reviewedByUserId: userId });
      else await api.rejectAdjustment(id, { reviewedByUserId: userId });
      await adjustments.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Adjustments"
        subtitle="Stock corrections require approval — and the approver must differ from the requester."
      />
      <ErrorBanner error={err ?? adjustments.error} />
      <p className="hint">
        Approving posts a compensating movement as <strong>{user?.name ?? "—"}</strong>. To
        approve a variance you raised, switch “Acting as” to a different user first.
      </p>

      <Card title="Adjustments">
        {adjustments.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Location</th>
                <th className="num">Delta</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(adjustments.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{itemName(a.itemId)}</td>
                  <td>{locName(a.locationId)}</td>
                  <td className="num">{fmt(a.baseQtyDelta)}</td>
                  <td>{a.reason}</td>
                  <td>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="num">
                    {a.status === "pending" && (
                      <span className="row gap">
                        <Button className="sm" onClick={() => review(a.id, "approve")}>
                          Approve
                        </Button>
                        <Button variant="danger" className="sm" onClick={() => review(a.id, "reject")}>
                          Reject
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {adjustments.data && adjustments.data.length === 0 && <EmptyRow cols={6} />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
