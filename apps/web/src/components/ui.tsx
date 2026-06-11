import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, ButtonHTMLAttributes } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
  learn,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  learn?: string;
}) {
  return (
    <div className="page-header">
      <div data-learn={learn}>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row gap">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="row gap">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
};
export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return <button className={`btn ${variant} ${className}`} {...rest} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info";

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="error">{error}</div>;
}

export function Loading({ what = "Loading…" }: { what?: string }) {
  return <p className="muted">{what}</p>;
}

export function EmptyRow({ cols, text = "Nothing yet." }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="muted center">
        {text}
      </td>
    </tr>
  );
}

/** Format a numeric string/​number, trimming trailing zeros. */
export function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "approved":
    case "received":
    case "matched":
    case "active":
    case "posted":
      return "ok";
    case "pending":
    case "in_transit":
    case "partially_received":
    case "draft":
    case "counting":
    case "open":
      return "warn";
    case "rejected":
    case "discrepancy":
    case "cancelled":
    case "locked":
      return "bad";
    default:
      return "neutral";
  }
}
