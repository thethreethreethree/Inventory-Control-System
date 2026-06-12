import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { PurchaseOrder, Supplier } from "../api/types";
import { Button, Card, ErrorBanner, Field, Input, Select } from "./ui";

const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Best-effort extraction of header fields from OCR'd receipt text. */
function parseReceipt(text: string) {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const numRe = /(\d[\d,]*\.\d{2})/g;

  let amount = "";
  const totalLine = [...lines].reverse().find((l) => /grand total|amount due|total/i.test(l));
  if (totalLine) {
    const m = totalLine.match(numRe);
    const last = m?.[m.length - 1];
    if (last) amount = last.replace(/,/g, "");
  }
  if (!amount) {
    const all = (text.match(numRe) ?? []).map((s) => Number(s.replace(/,/g, "")));
    if (all.length) amount = String(Math.max(...all));
  }

  let date = "";
  const dm = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (dm?.[1] && dm[2] && dm[3]) {
    const pad = (s: string) => s.padStart(2, "0");
    const yr = dm[3].length === 2 ? `20${dm[3]}` : dm[3];
    date = `${yr}-${pad(dm[2])}-${pad(dm[1])}`; // assume d/m/y
  }

  let invoiceNo = "";
  const im = text.match(/(?:invoice|inv|receipt|o\.?r\.?|ref|bill)[\s#:.no\-]*([A-Za-z0-9][A-Za-z0-9\-/]{2,})/i);
  if (im?.[1]) invoiceNo = im[1];

  const supplier =
    lines.find((l) => l.length >= 3 && /[A-Za-z]{3,}/.test(l) && !/receipt|invoice|official/i.test(l)) ??
    "";

  return { amount, date, invoiceNo, supplier };
}

export function ReceiptScanner({
  suppliers,
  pos,
  onSaved,
}: {
  suppliers: Supplier[];
  pos: PurchaseOrder[];
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [poId, setPoId] = useState("");

  async function onFile(f: File) {
    setErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus("scanning");
    setProgress(0);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const res = await Tesseract.recognize(f, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const p = parseReceipt(res.data.text);
      setAmount(p.amount);
      setInvoiceNo(p.invoiceNo);
      setInvoiceDate(p.date);
      if (p.supplier) {
        const key = p.supplier.toLowerCase();
        const match = suppliers.find(
          (s) => key.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(key.slice(0, 6)),
        );
        if (match) setSupplierId(match.id);
      }
      setStatus("ready");
    } catch (e) {
      setErr(`Couldn't read the image (${e instanceof Error ? e.message : "OCR error"}). Enter the details manually.`);
      setStatus("ready");
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setErr(null);
    setSaving(true);
    try {
      const att = await api.uploadAttachment(file);
      await api.recordInvoice({
        supplierId,
        poId: poId || undefined,
        invoiceNo,
        amount: n(amount),
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
        attachmentId: att.id,
      });
      setFile(null);
      setPreview(null);
      setStatus("idle");
      setSupplierId("");
      setInvoiceNo("");
      setAmount("");
      setInvoiceDate("");
      setPoId("");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="📷 Scan a vendor receipt">
      <p
        className="hint"
        data-learn="Upload or photograph a supplier receipt. The system reads it (OCR), pre-fills the invoice fields below for you to verify, then saves the invoice with the photo attached — which feeds the 3-way match."
        data-learn-tl="Mag-upload o kumuha ng litrato ng resibo. Babasahin ito ng sistema (OCR), pupunan ang invoice fields sa baba para i-verify mo, tapos ise-save ang invoice kasama ang litrato — na sasali sa 3-way match."
      >
        Upload or photograph the receipt — we'll read it and pre-fill the fields for you to check.
      </p>

      <label className="filebtn">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {file ? "Choose a different image" : "Upload / take photo"}
      </label>

      {preview && (
        <img src={preview} alt="receipt preview" className="receipt-preview" />
      )}

      {status === "scanning" && (
        <div className="scan-progress">
          Reading receipt… {progress}%
          <div className="bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <ErrorBanner error={err} />

      {status === "ready" && (
        <form onSubmit={save}>
          <p className="notice" style={{ marginTop: "0.5rem" }}>
            Scanned — please verify before saving.
          </p>
          <div className="form-row">
            <Field label="Supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="PO (optional)">
              <Select value={poId} onChange={(e) => setPoId(e.target.value)}>
                <option value="">(none)</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.reference ?? p.id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Invoice #">
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} required />
            </Field>
            <Field label="Amount">
              <Input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </Field>
            <Field label="Date">
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save invoice + receipt"}
          </Button>
        </form>
      )}
    </Card>
  );
}
