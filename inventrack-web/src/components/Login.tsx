"use client";
import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "./ui";
import { Brand } from "./Brand";

export function Login({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("maria@hubandsky.local");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(email, password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Brand variant="login" />
        <p className="tagline">Control. Track. Optimize.</p>
        <p className="muted">Sign in to continue</p>
        {err && <div className="error">{err}</div>}
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy} className="block">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="hint">
          Seeded admins: maria@ · bredily@ · remy@ · malou@hubandsky.local — staff:
          nikko@ · jason@hubandsky.local. Default password <strong>inventrack123</strong>
          (change it under Settings).
        </p>
      </form>
    </div>
  );
}
