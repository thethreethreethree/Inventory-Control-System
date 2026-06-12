import { api } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { Badge, Card, EmptyRow, ErrorBanner, Loading, PageHeader, fmt, money } from "../components/ui";

export function Reports() {
  const valuation = useAsync(() => api.reportValuation());
  const activity = useAsync(() => api.reportActivity());
  const varianceR = useAsync(() => api.reportVariance());
  const reorder = useAsync(() => api.reportReorder());
  const expiry = useAsync(() => api.reportExpiry(30));
  const lotsR = useAsync(() => api.reportLots());

  const totalValue = (valuation.data ?? []).reduce((s, r) => s + Number(r.value ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Reports"
        learn={`Reports — reading your audit views

Scroll through the cards: each answers a different question from the same ledger.
• Stock valuation — what every item is worth (on-hand × cost).
• Activity — what moved in the last 30 days.
• Variances — where counts didn't match (possible shrinkage).
• Reorder alerts — items at or below their reorder point.
• Expiring — lots nearing their expiry date.

You don't enter anything here — it is all derived from the records, ready for your daily, weekly and monthly review.`}
        learnTl={`Reports — pagbasa ng audit views

Mag-scroll sa cards: bawat isa'y sumasagot ng ibang tanong mula sa parehong ledger.
• Stock valuation — halaga ng bawat item (on-hand × presyo).
• Activity — ano ang gumalaw nitong 30 araw.
• Variances — saan hindi tugma ang count (posibleng shrinkage).
• Reorder alerts — items na nasa o pababa na sa reorder point.
• Expiring — lots na malapit nang mag-expire.

Walang ila-lagay dito — lahat ay galing sa records, handa para sa daily, weekly at monthly review mo.`}
        subtitle="Everything the ledger already knows — valuation, activity, shrinkage, and alerts."
      />
      <ErrorBanner error={valuation.error ?? activity.error ?? varianceR.error} />

      <div className="kpis">
        <div className="kpi">
          <div className="value">{money(totalValue)}</div>
          <div className="label">Inventory value (at avg cost)</div>
        </div>
        <div className="kpi">
          <div className="value">{varianceR.data?.length ?? "—"}</div>
          <div className="label">Variance lines (shrinkage signals)</div>
        </div>
        <div className="kpi">
          <div className="value">{reorder.data?.length ?? "—"}</div>
          <div className="label">Items at/below reorder</div>
        </div>
      </div>

      <Card title="Stock valuation">
        {valuation.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th className="num">On hand</th>
                <th className="num">Avg cost / unit</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {(valuation.data ?? []).map((r, i) => (
                <tr key={i}>
                  <td>{r.sku}</td>
                  <td>{r.name}</td>
                  <td className="num">
                    {fmt(r.on_hand)} {r.unit}
                  </td>
                  <td className="num">{r.avg_cost_per_base ? money(r.avg_cost_per_base) : "—"}</td>
                  <td className="num">{r.value ? money(r.value) : "—"}</td>
                </tr>
              ))}
              {valuation.data && valuation.data.length === 0 && <EmptyRow cols={5} />}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Lots on hand (FEFO order — earliest expiry consumed first)">
        {lotsR.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Lot</th>
                <th>Location</th>
                <th>Expiry</th>
                <th className="num">On hand</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(lotsR.data ?? []).map((r, i) => (
                <tr key={i}>
                  <td>{String(r.sku)}</td>
                  <td>{r.lot_no ? String(r.lot_no) : "—"}</td>
                  <td>{String(r.location)}</td>
                  <td>{r.expiry_date ? new Date(String(r.expiry_date)).toLocaleDateString() : "—"}</td>
                  <td className="num">{fmt(r.on_hand as string)}</td>
                  <td>{r.expired ? <Badge tone="bad">expired</Badge> : null}</td>
                </tr>
              ))}
              {lotsR.data && lotsR.data.length === 0 && (
                <EmptyRow cols={6} text="No lot-tracked stock yet (receive with a lot/expiry)." />
              )}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid2">
        <Card title="Activity — last 30 days">
          {activity.loading ? (
            <Loading />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="num">Movements</th>
                  <th className="num">Net qty</th>
                </tr>
              </thead>
              <tbody>
                {(activity.data ?? []).map((r, i) => (
                  <tr key={i}>
                    <td>
                      <Badge tone={Number(r.net_base) >= 0 ? "ok" : "bad"}>{String(r.type)}</Badge>
                    </td>
                    <td className="num">{String(r.movements)}</td>
                    <td className="num">{fmt(r.net_base as string)}</td>
                  </tr>
                ))}
                {activity.data && activity.data.length === 0 && <EmptyRow cols={3} />}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Count variances (shrinkage)">
          {varianceR.loading ? (
            <Loading />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Location</th>
                  <th className="num">Counted</th>
                  <th className="num">Expected</th>
                  <th className="num">Variance</th>
                </tr>
              </thead>
              <tbody>
                {(varianceR.data ?? []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.sku}</td>
                    <td>{r.location}</td>
                    <td className="num">{fmt(r.counted)}</td>
                    <td className="num">{fmt(r.expected)}</td>
                    <td className="num">
                      <Badge tone="bad">{fmt(r.variance)}</Badge>
                    </td>
                  </tr>
                ))}
                {varianceR.data && varianceR.data.length === 0 && (
                  <EmptyRow cols={5} text="No variances — counts matched the ledger." />
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="grid2">
        <Card title="Reorder alerts">
          {reorder.loading ? (
            <Loading />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num">On hand</th>
                  <th className="num">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {(reorder.data ?? []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.sku}</td>
                    <td className="num">
                      {fmt(r.on_hand)} {r.unit}
                    </td>
                    <td className="num">{fmt(r.threshold)}</td>
                  </tr>
                ))}
                {reorder.data && reorder.data.length === 0 && (
                  <EmptyRow cols={3} text="All items above their reorder threshold." />
                )}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Expiring within 30 days">
          {expiry.loading ? (
            <Loading />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Lot</th>
                  <th>Expiry</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {(expiry.data ?? []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.sku}</td>
                    <td>{r.lot_no ?? "—"}</td>
                    <td>{r.expiry_date ? new Date(String(r.expiry_date)).toLocaleDateString() : "—"}</td>
                    <td className="num">{fmt(r.qty)}</td>
                  </tr>
                ))}
                {expiry.data && expiry.data.length === 0 && (
                  <EmptyRow cols={4} text="Nothing expiring soon." />
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
