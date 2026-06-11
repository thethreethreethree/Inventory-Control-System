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
  money,
  statusTone,
} from "../components/ui";

const UNITS = ["case", "bottle", "each", "ml", "g"];

export function Purchasing() {
  const { userId } = useActingUser();
  const items = useAsync(() => api.items());
  const locations = useAsync(() => api.locations());
  const suppliers = useAsync(() => api.suppliers());
  const pos = useAsync(() => api.purchaseOrders());
  const invoices = useAsync(() => api.invoices());
  const [err, setErr] = useState<string | null>(null);

  const supName = (id: string) => suppliers.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : String(e));

  // supplier
  const [supName2, setSupName] = useState("");
  async function addSupplier(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createSupplier({ name: supName2 });
      setSupName("");
      await suppliers.reload();
    } catch (e) {
      fail(e);
    }
  }

  // PO
  const [poSup, setPoSup] = useState("");
  const [poItem, setPoItem] = useState("");
  const [poQty, setPoQty] = useState("");
  const [poUnit, setPoUnit] = useState("case");
  const [poCost, setPoCost] = useState("");
  async function createPO(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createPO({
        supplierId: poSup,
        orderedByUserId: userId,
        lines: [
          { itemId: poItem, qtyOrdered: Number(poQty), unitCode: poUnit, unitCost: Number(poCost) || undefined },
        ],
      });
      setPoQty("");
      setPoCost("");
      await pos.reload();
    } catch (e) {
      fail(e);
    }
  }
  async function approve(id: string) {
    setErr(null);
    try {
      await api.approvePO(id, { approvedByUserId: userId });
      await pos.reload();
    } catch (e) {
      fail(e);
    }
  }

  // receive
  const [rcvPo, setRcvPo] = useState("");
  const [rcvLoc, setRcvLoc] = useState("");
  const [rcvItem, setRcvItem] = useState("");
  const [rcvQty, setRcvQty] = useState("");
  const [rcvUnit, setRcvUnit] = useState("case");
  const [rcvCost, setRcvCost] = useState("");
  async function receive(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.receiveGoods({
        poId: rcvPo || undefined,
        locationId: rcvLoc,
        receivedByUserId: userId,
        lines: [
          { itemId: rcvItem, qtyReceived: Number(rcvQty), unitCode: rcvUnit, unitCost: Number(rcvCost) || undefined },
        ],
      });
      setRcvQty("");
      setRcvCost("");
      await pos.reload();
    } catch (e) {
      fail(e);
    }
  }

  // invoice
  const [invSup, setInvSup] = useState("");
  const [invPo, setInvPo] = useState("");
  const [invNo, setInvNo] = useState("");
  const [invAmt, setInvAmt] = useState("");
  async function recordInvoice(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.recordInvoice({
        supplierId: invSup,
        poId: invPo || undefined,
        invoiceNo: invNo,
        amount: Number(invAmt),
      });
      setInvNo("");
      setInvAmt("");
      await invoices.reload();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <>
      <PageHeader
        title="Purchasing"
        learn="Run the buying cycle here: raise a purchase order, receive the goods (which adds stock), then match the supplier invoice against what was ordered and received."
        subtitle="PO → GRN → Invoice, 3-way matched. Approving a PO requires a different user than its creator."
      />
      <ErrorBanner error={err} />

      <div className="grid2">
        <Card title="Suppliers">
          <form onSubmit={addSupplier}>
            <div className="form-row">
              <Field label="Name">
                <Input value={supName2} onChange={(e) => setSupName(e.target.value)} required />
              </Field>
              <Button type="submit" variant="ghost">
                Add
              </Button>
            </div>
          </form>
          <table className="tbl" style={{ marginTop: "0.5rem" }}>
            <tbody>
              {(suppliers.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted">{s.terms ?? ""}</td>
                </tr>
              ))}
              {suppliers.data && suppliers.data.length === 0 && <EmptyRow cols={2} />}
            </tbody>
          </table>
        </Card>

        <Card title="Create purchase order">
          <form onSubmit={createPO}>
            <Field label="Supplier">
              <Select value={poSup} onChange={(e) => setPoSup(e.target.value)} required>
                <option value="">Select…</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="form-row">
              <Field label="Item">
                <Select value={poItem} onChange={(e) => setPoItem(e.target.value)} required>
                  <option value="">Select…</option>
                  {(items.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sku}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Qty">
                <Input type="number" step="any" min="0" value={poQty} onChange={(e) => setPoQty(e.target.value)} required />
              </Field>
              <Field label="Unit">
                <Select value={poUnit} onChange={(e) => setPoUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Unit cost">
                <Input type="number" step="any" min="0" value={poCost} onChange={(e) => setPoCost(e.target.value)} />
              </Field>
            </div>
            <Button type="submit">Create PO</Button>
          </form>
        </Card>
      </div>

      <Card title="Purchase orders">
        {pos.loading ? (
          <Loading />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Ordered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(pos.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.reference ?? p.id.slice(0, 8)}</td>
                  <td>{supName(p.supplierId)}</td>
                  <td>
                    <Badge tone={statusTone(p.status)}>{p.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="muted">{new Date(p.orderedAt).toLocaleDateString()}</td>
                  <td className="num">
                    {p.status === "draft" && (
                      <Button className="sm" onClick={() => approve(p.id)}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {pos.data && pos.data.length === 0 && <EmptyRow cols={5} />}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid2">
        <Card title="Receive goods (GRN)">
          <form onSubmit={receive}>
            <div className="form-row">
              <Field label="Against PO">
                <Select value={rcvPo} onChange={(e) => setRcvPo(e.target.value)}>
                  <option value="">(ad-hoc)</option>
                  {(pos.data ?? [])
                    .filter((p) => ["approved", "sent", "partially_received"].includes(p.status))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.reference ?? p.id.slice(0, 8)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Into">
                <Select value={rcvLoc} onChange={(e) => setRcvLoc(e.target.value)} required>
                  <option value="">Select…</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Item">
                <Select value={rcvItem} onChange={(e) => setRcvItem(e.target.value)} required>
                  <option value="">Select…</option>
                  {(items.data ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sku}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Qty">
                <Input type="number" step="any" min="0" value={rcvQty} onChange={(e) => setRcvQty(e.target.value)} required />
              </Field>
              <Field label="Unit">
                <Select value={rcvUnit} onChange={(e) => setRcvUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Unit cost">
                <Input type="number" step="any" min="0" value={rcvCost} onChange={(e) => setRcvCost(e.target.value)} />
              </Field>
            </div>
            <Button type="submit">Receive</Button>
          </form>
        </Card>

        <Card title="Record invoice (3-way match)">
          <form onSubmit={recordInvoice}>
            <div className="form-row">
              <Field label="Supplier">
                <Select value={invSup} onChange={(e) => setInvSup(e.target.value)} required>
                  <option value="">Select…</option>
                  {(suppliers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="PO">
                <Select value={invPo} onChange={(e) => setInvPo(e.target.value)}>
                  <option value="">(none)</option>
                  {(pos.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.reference ?? p.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Invoice #">
                <Input value={invNo} onChange={(e) => setInvNo(e.target.value)} required />
              </Field>
              <Field label="Amount">
                <Input type="number" step="any" min="0" value={invAmt} onChange={(e) => setInvAmt(e.target.value)} required />
              </Field>
              <Button type="submit">Record</Button>
            </div>
          </form>
          <table className="tbl" style={{ marginTop: "0.5rem" }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th className="num">Amount</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {(invoices.data ?? []).map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNo}</td>
                  <td className="num">{money(inv.amount)}</td>
                  <td>
                    <Badge tone={statusTone(inv.matchStatus)}>{inv.matchStatus}</Badge>
                    {inv.matchDetail && inv.matchStatus === "discrepancy" && (
                      <span className="muted">
                        {" "}
                        (Δ {money(inv.matchDetail.invoiceVsReceived)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.data && invoices.data.length === 0 && <EmptyRow cols={3} />}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
