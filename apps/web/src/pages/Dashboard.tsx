import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { Badge, Button, Card, EmptyRow, ErrorBanner, Loading, PageHeader, fmt } from "../components/ui";

export function Dashboard() {
  const balances = useAsync(() => api.balances());
  const pending = useAsync(() => api.adjustments("?status=pending"));
  const transfers = useAsync(() => api.transfers());

  const inTransit = (transfers.data ?? []).filter((t) => t.status === "in_transit").length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="On-hand is derived from the ledger (SUM of movements) — never a stored number."
        actions={
          <Button
            variant="ghost"
            onClick={() => api.rebuildBalances().then(() => balances.reload())}
          >
            Rebuild cache from ledger
          </Button>
        }
      />
      <ErrorBanner error={balances.error} />

      <div className="kpis">
        <div className="kpi">
          <div className="value">{balances.data?.length ?? "—"}</div>
          <div className="label">Stock lines (item × location)</div>
        </div>
        <div className="kpi">
          <div className="value">{pending.data?.length ?? "—"}</div>
          <div className="label">Pending approvals</div>
        </div>
        <div className="kpi">
          <div className="value">{transfers.data ? inTransit : "—"}</div>
          <div className="label">Transfers in transit</div>
        </div>
      </div>

      <Card title="On-hand balances">
        {balances.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
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
              {(balances.data ?? []).map((b) => (
                <tr key={`${b.sku}-${b.location}`}>
                  <td>{b.sku}</td>
                  <td>{b.item}</td>
                  <td>{b.location}</td>
                  <td className="num">{fmt(b.on_hand)}</td>
                  <td>{b.unit}</td>
                </tr>
              ))}
              {balances.data && balances.data.length === 0 && <EmptyRow cols={5} />}
            </tbody>
          </table>
        )}
      </Card>

      {(pending.data?.length ?? 0) > 0 && (
        <Card title="Needs attention">
          <p className="muted">
            {pending.data?.length} adjustment(s) awaiting approval —{" "}
            <Badge tone="warn">review on the Adjustments page</Badge>
          </p>
        </Card>
      )}
    </>
  );
}
