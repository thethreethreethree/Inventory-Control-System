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
        learn={`Settings — configuring the system

Work through the cards and press "Save settings" when done:
• Business — your name, currency, and default location.
• Accuracy & control — guards that keep stock exact: prevent negative stock, and require approval for count gaps.
• Learning mode — the click-to-learn help you are reading now.

Below, add your Locations (branches) and Categories, change your password, and see the users and their roles.`}
        learnTl={`Settings — pag-configure ng sistema

Dumaan sa cards at pindutin ang "Save settings" pagtapos:
• Business — pangalan, currency, at default na lokasyon.
• Accuracy & control — guards para tumpak ang stock: harangan ang negative stock, at hingan ng approval ang count gaps.
• Learning mode — ang click-to-learn na binabasa mo ngayon.

Sa ibaba, magdagdag ng Locations (branch) at Categories, palitan ang password, at tingnan ang users at roles nila.`}
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
              data-learn={`Prevent negative stock

Stock should never be a negative number — you can't pour from a bottle that isn't there. A negative balance almost always means something wasn't recorded (a delivery never logged, a wrong count).

When this is ON, the system refuses any issue, sale or transfer that would push an item below zero at a location, forcing the real problem to be fixed first.

Leave it ON unless you have a specific reason to allow negatives.`}
              data-learn-tl={`Iwasan ang negative stock

Hindi dapat negatibo ang stock — 'di ka makakabuhos mula sa boteng wala. Ang negatibo ay halos laging ibig sabihin may hindi naitala (delivery na 'di na-log, maling bilang).

Kapag ON ito, tinatanggihan ng sistema ang anumang issue, sale o transfer na magpapababa sa item nang wala sa zero, kaya kailangang ayusin muna ang tunay na problema.

Iwang ON maliban kung may espesipikong dahilan para payagan ang negatibo.`}
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
              data-learn={`Require approval for count variances

A "variance" is the gap a stocktake finds between what you counted and what the system expected. Correcting stock is sensitive — it can hide a loss.

When this is ON, every variance must be approved by a second person (a manager) before stock is corrected, so no single person can adjust the books alone.

When OFF, small gaps within your tolerance % can post automatically. Keep it ON for tighter control.`}
              data-learn-tl={`Hingan ng approval ang count variances

Ang "variance" ay ang pagitan na nakikita ng stocktake sa binilang mo at sa inaasahan ng sistema. Sensitibo ang pagwawasto ng stock — pwedeng pagtakpan ang kalugihan.

Kapag ON, kailangang aprubahan ng pangalawang tao (manager) ang bawat variance bago maitama ang stock, kaya walang iisang tao na mag-aayos ng libro mag-isa.

Kapag OFF, pwedeng automatic ang maliliit na gap na nasa loob ng tolerance %. Iwang ON para mas mahigpit.`}
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
              data-learn={`Enable click-to-learn tutorial

This is the switch for the learning mode you are using right now.

When it is ON, important buttons, fields and links across every page get a dashed highlight. Clicking one opens a plain-language explanation (like this) instead of performing the action.

After reading, press "Got it — continue" to carry out what you clicked, so you can learn and keep working at the same time. Turn it off here once your team is confident.`}
              data-learn-tl={`I-enable ang click-to-learn tutorial

Ito ang switch para sa learning mode na ginagamit mo ngayon.

Kapag ON, ang mahahalagang button, field at link sa bawat page ay may dashed na highlight. Kapag kino-click, magbubukas ng madaling-intindihang paliwanag (tulad nito) sa halip na gawin agad ang aksyon.

Pagkabasa, pindutin ang "Naintindihan — magpatuloy" para gawin ang pinindot mo, kaya natututo ka habang gumagawa. I-off dito kapag sanay na ang team mo.`}
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
