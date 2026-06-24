"use client";
import { useState } from "react";
import { Field, Input } from "./ui";

const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const fmt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: 4 });

type Tab = "qty" | "value" | "variance";

/** Inventory / accounting calculator — available on every page. */
export function Calculator({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("qty");
  return (
    <div className="calc-panel">
      <div className="calc-head">
        <strong>Calculator</strong>
        <button className="calc-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="calc-tabs">
        <button className={tab === "qty" ? "on" : ""} onClick={() => setTab("qty")}>
          Quantity
        </button>
        <button className={tab === "value" ? "on" : ""} onClick={() => setTab("value")}>
          Value
        </button>
        <button className={tab === "variance" ? "on" : ""} onClick={() => setTab("variance")}>
          Variance
        </button>
      </div>
      <div className="calc-body">
        {tab === "qty" && <QtyCalc />}
        {tab === "value" && <ValueCalc />}
        {tab === "variance" && <VarianceCalc />}
      </div>
    </div>
  );
}

/** Convert packs (cases / bottles / loose) into base units. */
function QtyCalc() {
  const [cases, setCases] = useState("");
  const [perCase, setPerCase] = useState("12");
  const [units, setUnits] = useState("");
  const [size, setSize] = useState("750");
  const [loose, setLoose] = useState("");
  const total = n(cases) * n(perCase) * n(size) + n(units) * n(size) + n(loose);
  return (
    <>
      <p className="calc-hint">Packs → base units (e.g. bottles × ml, cases × bottles).</p>
      <div className="form-row">
        <Field label="Cases">
          <Input type="number" step="any" value={cases} onChange={(e) => setCases(e.target.value)} />
        </Field>
        <Field label="Units / case">
          <Input type="number" step="any" value={perCase} onChange={(e) => setPerCase(e.target.value)} />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Units (e.g. bottles)">
          <Input type="number" step="any" value={units} onChange={(e) => setUnits(e.target.value)} />
        </Field>
        <Field label="Unit size (base)">
          <Input type="number" step="any" value={size} onChange={(e) => setSize(e.target.value)} />
        </Field>
      </div>
      <Field label="Loose (base units, e.g. mL)">
        <Input type="number" step="any" value={loose} onChange={(e) => setLoose(e.target.value)} />
      </Field>
      <div className="calc-result">= {fmt(total)} base units</div>
    </>
  );
}

/** Line value and margin / markup. */
function ValueCalc() {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const total = n(qty) * n(cost);
  const c = n(cost);
  const p = n(price);
  const margin = p > 0 ? ((p - c) / p) * 100 : 0;
  const markup = c > 0 ? ((p - c) / c) * 100 : 0;
  return (
    <>
      <p className="calc-hint">Line value, margin and markup.</p>
      <div className="form-row">
        <Field label="Quantity">
          <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Unit cost">
          <Input type="number" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
      </div>
      <div className="calc-result">Line value = {fmt(total)}</div>
      <Field label="Sell price (for margin)">
        <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <div className="calc-sub">
        Margin {margin.toFixed(1)}% · Markup {markup.toFixed(1)}%
      </div>
    </>
  );
}

/** Stocktake variance: counted vs theoretical. */
function VarianceCalc() {
  const [counted, setCounted] = useState("");
  const [expected, setExpected] = useState("");
  const v = n(counted) - n(expected);
  const pct = n(expected) !== 0 ? (v / n(expected)) * 100 : 0;
  return (
    <>
      <p className="calc-hint">Counted vs theoretical on-hand.</p>
      <div className="form-row">
        <Field label="Counted">
          <Input type="number" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} />
        </Field>
        <Field label="Expected">
          <Input type="number" step="any" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </Field>
      </div>
      <div className={`calc-result ${v === 0 ? "" : "neg"}`}>
        Variance = {fmt(v)} ({pct.toFixed(1)}%)
      </div>
    </>
  );
}
