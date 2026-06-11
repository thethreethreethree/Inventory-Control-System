import { useEffect, useState, type FormEvent } from "react";
import { api, type AppSettings } from "../api/client";
import { useAsync } from "../lib/useAsync";
import { useLearn } from "../lib/learn";
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

export function Settings() {
  const { setEnabled } = useLearn();
  const loaded = useAsync(() => api.settings());
  const locations = useAsync(() => api.locations());
  const cats = useAsync(() => api.categories());
  const users = useAsync(() => api.users());

  const [s, setS] = useState<AppSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (loaded.data) setS(loaded.data);
  }, [loaded.data]);

  const patch = (p: Partial<AppSettings>) => setS((cur) => (cur ? { ...cur, ...p } : cur));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!s) return;
    setErr(null);
    setSaved(false);
    try {
      const next = await api.updateSettings(s);
      setS(next);
      setEnabled(next.tutorialEnabled); // apply learning mode immediately
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  // add location / category
  const [locName, setLocName] = useState("");
  const [locType, setLocType] = useState("bar");
  const [catName, setCatName] = useState("");

  // change password
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  async function changePw(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    try {
      await api.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: "", next: "" });
      setPwMsg("Password changed.");
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Failed to change password");
    }
  }
  async function addLoc(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createLocation({ name: locName, type: locType });
      setLocName("");
      await locations.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  async function addCat(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.createCategory({ name: catName });
      setCatName("");
      await cats.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure the business, accuracy guards, learning mode, locations and categories."
        learn="The Settings page configures how the whole system behaves — your business name and currency, the accuracy guards that keep inventory exact, the learning mode you're using now, plus your locations and categories."
      />
      <ErrorBanner error={err ?? loaded.error} />
      {saved && <div className="notice">Settings saved.</div>}

      {!s ? (
        <Loading />
      ) : (
        <form onSubmit={save}>
          <Card title="Business">
            <div className="form-row">
              <Field label="Business name">
                <Input value={s.businessName} onChange={(e) => patch({ businessName: e.target.value })} />
              </Field>
              <Field label="Currency">
                <Input value={s.currency} onChange={(e) => patch({ currency: e.target.value })} />
              </Field>
              <Field label="Default location">
                <Select
                  value={s.defaultLocationId ?? ""}
                  onChange={(e) => patch({ defaultLocationId: e.target.value || null })}
                >
                  <option value="">(none)</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Accuracy & control">
            <label
              className="toggle"
              data-learn="When ON, the ledger refuses any issue, sale or transfer that would push stock below zero at a location — you can never remove what isn't there. Turn off only if you intentionally allow negative balances."
            >
              <input
                type="checkbox"
                checked={!s.allowNegativeStock}
                onChange={(e) => patch({ allowNegativeStock: !e.target.checked })}
              />
              <span>Prevent negative stock (recommended)</span>
            </label>
            <label
              className="toggle"
              data-learn="When ON, every count variance must be approved by a manager before stock is corrected. When OFF, variances within tolerance can post automatically."
            >
              <input
                type="checkbox"
                checked={s.requireApprovalForVariances}
                onChange={(e) => patch({ requireApprovalForVariances: e.target.checked })}
              />
              <span>Require approval for count variances</span>
            </label>
            <Field label="Default count tolerance (%)">
              <Input
                type="number"
                step="any"
                min="0"
                value={String(s.countTolerancePct)}
                onChange={(e) => patch({ countTolerancePct: Number(e.target.value) })}
              />
            </Field>
          </Card>

          <Card title="Learning mode">
            <label
              className="toggle"
              data-learn="This is the switch for the click-based learning system. With it ON, key elements across every page highlight, and clicking one explains what it does instead of performing the action."
            >
              <input
                type="checkbox"
                checked={s.tutorialEnabled}
                onChange={(e) => patch({ tutorialEnabled: e.target.checked })}
              />
              <span>Enable click-to-learn tutorial</span>
            </label>
            <p className="hint">
              When on, click any highlighted element to learn what it does. Save to apply.
            </p>
          </Card>

          <Button type="submit">Save settings</Button>
        </form>
      )}

      <div className="grid2" style={{ marginTop: "1.25rem" }}>
        <Card title="Locations">
          <form onSubmit={addLoc}>
            <div className="form-row">
              <Field label="Name">
                <Input value={locName} onChange={(e) => setLocName(e.target.value)} required />
              </Field>
              <Field label="Type">
                <Select value={locType} onChange={(e) => setLocType(e.target.value)}>
                  {["bar", "store", "kitchen", "room_service", "spa", "other"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="ghost">
                Add
              </Button>
            </div>
          </form>
          <table className="tbl" style={{ marginTop: "0.5rem" }}>
            <tbody>
              {(locations.data ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td className="muted">{l.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Categories">
          <form onSubmit={addCat}>
            <div className="form-row">
              <Field label="Name">
                <Input value={catName} onChange={(e) => setCatName(e.target.value)} required />
              </Field>
              <Button type="submit" variant="ghost">
                Add
              </Button>
            </div>
          </form>
          <table className="tbl" style={{ marginTop: "0.5rem" }}>
            <tbody>
              {(cats.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                </tr>
              ))}
              {cats.data && cats.data.length === 0 && <EmptyRow cols={1} />}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="My account">
        <form onSubmit={changePw}>
          <div className="form-row">
            <Field label="Current password">
              <Input
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                required
              />
            </Field>
            <Field label="New password (min 6)">
              <Input
                type="password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                required
              />
            </Field>
            <Button type="submit" variant="ghost">
              Change password
            </Button>
          </div>
        </form>
        {pwMsg && <p className="hint">{pwMsg}</p>}
      </Card>

      <Card title="Users & roles">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="muted">{u.email}</td>
                <td>
                  <Badge tone={statusTone(u.status)}>{u.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
