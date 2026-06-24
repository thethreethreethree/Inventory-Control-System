"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActingUser } from "../lib/actingUser";
import { Brand } from "./Brand";
import { Calculator } from "./Calculator";
import { LearnLayer } from "../lib/learn";

const NAV = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    learn: `Dashboard — your live overview

This is the home screen. It sums up the whole business at a glance.

The figures here are calculated live from the records, so they are always the real current numbers — nothing is typed in by hand.

Open it when you want a quick health check: how many stock lines you hold, what is waiting for approval, and what is moving between branches.`,
    learnTl: `Dashboard — buod sa isang tingin

Ito ang home screen. Buod ng buong negosyo sa isang sulyap.

Live na kinukwenta mula sa records ang mga numero dito, kaya lagi itong totoong kasalukuyang bilang — walang basta tina-type.

Buksan kapag gusto mo ng mabilis na tsek: ilang stock lines, ano ang naghihintay ng approval, at anong gumagalaw sa pagitan ng branches.`,
  },
  {
    to: "/items",
    label: "Items",
    learn: `Items — your product list (the "item master")

Every product you track lives here: drinks, ingredients, supplies — each with its category, unit of measure, current stock and cost.

"On hand" is how much you have right now. "Unit" is how you measure it (each, bottle, ml, g).

Use search and the category filter to find anything. Admins can add a new product with "+ New item".`,
    learnTl: `Items — listahan ng produkto (ang "item master")

Nandito lahat ng tinatrack mong produkto: inumin, sangkap, gamit — may kategorya, unit, kasalukuyang stock at presyo.

Ang "On hand" ay kung ilan ang meron ka ngayon. Ang "Unit" ay kung paano mo sinusukat (each, bottle, ml, g).

Gamitin ang search at category filter para humanap. Pwedeng magdagdag ang admin gamit ang "+ New item".`,
  },
  {
    to: "/movements",
    label: "Movements",
    learn: `Movements — record every stock change

Every time stock comes in or goes out, you log it here as a "movement". The history of all movements is called the ledger — the system's permanent record book.

Pick a type and the system adds or subtracts automatically: receipt (+), issue/sale (−), waste (−), breakage (−), comp = given away (−).

You can't edit or delete a past entry — to fix a mistake you add a correcting entry, so the trail stays honest.`,
    learnTl: `Movements — itala ang bawat galaw ng stock

Tuwing may pumapasok o lumalabas na stock, itala mo dito bilang "movement". Ang kabuuang tala ay tinatawag na ledger — ang permanenteng record book ng sistema.

Pumili ng type at automatic na magdadagdag o magbabawas: receipt (+), issue/benta (−), waste (−), breakage (−), comp = ibinigay (−).

Hindi pwedeng i-edit o burahin ang lumang entry — para itama, magdagdag ka ng pamparehong entry, kaya laging tapat ang record.`,
  },
  {
    to: "/transfers",
    label: "Transfers",
    learn: `Transfers — move stock between branches

Use this to send stock from one location to another (e.g. main store → bar).

It works in two steps so nothing goes missing: the sender ships it (stock leaves their branch), then the receiver confirms it arrived (stock lands at the new branch). In between it is "in transit" — counted at neither place.

This gives you a clear who-sent / who-received record for every transfer.`,
    learnTl: `Transfers — ilipat ang stock sa ibang branch

Gamitin para magpadala ng stock mula isang lokasyon papunta sa iba (hal. main store → bar).

Dalawang hakbang para walang mawala: ipapadala ng nagbigay (lalabas sa branch nila), tapos iko-confirm ng tatanggap na dumating (papasok sa bagong branch). Habang nasa daan, "in transit" — hindi pa bilang sa kahit saan.

May malinaw kang record kung sino nagpadala / sino tumanggap.`,
  },
  {
    to: "/counts",
    label: "Counts",
    learn: `Counts — physically count your stock (stocktake)

A "count" (or stocktake) is when you walk around and physically count what is actually on the shelf, then type those numbers here.

The system keeps a running figure of what you SHOULD have. The gap between your count and that figure is the "variance" — usually caused by spills, over-pouring, breakage or theft.

A count never changes your stock by itself. It only reveals the gap; a manager then approves the correction.`,
    learnTl: `Counts — pisikal na bilangin ang stock (stocktake)

Ang "count" (o stocktake) ay kapag pisikal mong binibilang ang aktwal na nasa shelf, tapos ila-lagay mo dito ang numero.

May running figure ang sistema kung ilan DAPAT meron ka. Ang pagitan ng bilang mo at nito ang "variance" — kadalasang dulot ng tapon, sobrang buhos, basag o nakaw.

Hindi binabago ng count mismo ang stock. Pinapakita lang ang pagitan; saka aaprubahan ng manager ang pagwawasto.`,
  },
  {
    to: "/adjustments",
    label: "Adjustments",
    learn: `Adjustments — approve stock corrections

When a count finds a gap, the system proposes a correction called an "adjustment". This page is where those get approved or rejected.

Approving one writes the fix into the ledger so your stock matches reality.

Key safety rule: the person approving must be different from the person who raised it (this is called "separation of duties"). It stops anyone from quietly covering up a loss.`,
    learnTl: `Adjustments — aprubahan ang pagwawasto ng stock

Kapag may natuklasang pagitan ang count, may panukalang pagwawasto na tinatawag na "adjustment". Dito ito ina-approve o nire-reject.

Kapag in-approve, isusulat ang ayos sa ledger para tugma sa totoo ang stock.

Mahalagang panuntunan: dapat ibang tao ang nag-approve kaysa sa nag-request ("separation of duties"). Pumipigil ito sa sinumang gustong magtago ng kalugihan.`,
  },
  {
    to: "/purchasing",
    label: "Purchasing",
    learn: `Purchasing — buying from suppliers

This is the whole buying cycle in one place, in three steps:

1. Purchase Order (PO) — what you ordered from a supplier.
2. Receiving (GRN) — what actually arrived at the door (this adds stock).
3. Invoice — what the supplier billed you.

Matching all three (a "3-way match") catches being overcharged or shorted. You can even photograph a paper receipt and let the system read it.`,
    learnTl: `Purchasing — pagbili sa mga supplier

Buong proseso ng pagbili sa isang lugar, tatlong hakbang:

1. Purchase Order (PO) — ang in-order mo sa supplier.
2. Receiving (GRN) — ang aktwal na dumating sa pinto (dinadagdag sa stock).
3. Invoice — ang siningil sa'yo ng supplier.

Ang pag-tugma ng tatlo ("3-way match") ay humuhuli ng sobrang singil o kulang. Pwede mo pang kunan ng litrato ang resibo at babasahin ito ng sistema.`,
  },
  {
    to: "/recipes",
    label: "Recipes & Sales",
    learn: `Recipes & Sales — sell a drink, auto-subtract the ingredients

A "recipe" lists what one serving uses — e.g. a Gin & Tonic = 45 ml gin + 150 ml tonic.

Once recipes are set, you record sales (type them in or import from your POS) and the system automatically subtracts each ingredient from stock.

This means you capture usage without keying every single pour by hand.`,
    learnTl: `Recipes & Sales — magbenta ng inumin, automatic bawas ang sangkap

Ang "recipe" ay listahan ng gamit kada serving — hal. Gin & Tonic = 45 ml gin + 150 ml tonic.

Kapag naka-set na, ita-tala mo ang benta (i-type o i-import mula POS) at automatic na ibinabawas ng sistema ang bawat sangkap sa stock.

Nakukuha ang konsumo nang hindi mo kino-key isa-isa ang bawat buhos.`,
  },
  {
    to: "/periods",
    label: "Periods",
    learn: `Periods — close the books for a day, week or month

An accounting "period" is a block of time (a day, week or month) you finalize after it has been checked.

When you "close and lock" a period, the system blocks anyone from sneaking a back-dated entry into that finished time window.

This keeps audited figures frozen and trustworthy — nobody can quietly change last month after it is signed off.`,
    learnTl: `Periods — isara ang libro para sa araw, linggo o buwan

Ang accounting "period" ay tagal ng panahon (araw, linggo, buwan) na fina-finalize matapos ma-tsek.

Kapag "close and lock", hinaharangan ng sistema ang sinumang magtatangkang mag-insert ng back-dated na entry sa tapos nang panahon.

Nananatiling nakapirmi at maaasahan ang na-audit na numero — walang makakapagbago sa nakaraang buwan kapag tapos na.`,
  },
  {
    to: "/reports",
    label: "Reports",
    learn: `Reports — the numbers that drive decisions

This turns the ledger into answers, all from the same trustworthy records:

• Valuation — how much your stock is worth right now.
• Activity — what moved over the last 30 days.
• Variance / shrinkage — where you are losing stock.
• Reorder alerts — what is running low.
• Expiring lots — what to use before it spoils.

These are your daily, weekly and monthly audit views.`,
    learnTl: `Reports — ang numerong gabay sa desisyon

Ginagawang sagot ang ledger, lahat mula sa parehong maaasahang records:

• Valuation — magkano ang halaga ng stock mo ngayon.
• Activity — ano ang gumalaw nitong 30 araw.
• Variance / shrinkage — saan ka nalulugi ng stock.
• Reorder alerts — ano ang nau-ubos na.
• Expiring lots — ano ang gamitin bago masira.

Ito ang daily, weekly at monthly audit views mo.`,
  },
  {
    to: "/settings",
    label: "Settings",
    learn: `Settings — set up how the system behaves

Here you configure the basics and the safety rules:

• Business name and currency.
• "Accuracy guards" — e.g. block stock from going below zero, and require approval for count gaps.
• This learning mode (turn it on or off).
• Your locations (branches) and categories.

Change a setting, then press Save to apply it.`,
    learnTl: `Settings — i-set kung paano kumikilos ang sistema

Dito iko-configure ang basics at safety rules:

• Pangalan ng negosyo at currency.
• "Accuracy guards" — hal. harangan ang stock na bumaba sa zero, at hingan ng approval ang mga count gap.
• Itong learning mode (i-on o i-off).
• Mga lokasyon (branch) at kategorya.

Baguhin ang setting, tapos pindutin ang Save para mag-apply.`,
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<"up" | "down" | "…">("…");
  const [calcOpen, setCalcOpen] = useState(false);
  const { user, logout } = useActingUser();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const tick = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((h: { db?: string }) => setDb(h.db === "up" ? "up" : "down"))
        .catch(() => setDb("down"));
    void tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand />
        <nav>
          {NAV.map((n) => {
            const active = n.end ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                href={n.to}
                data-learn={n.learn}
                data-learn-tl={n.learnTl}
                className={active ? "nav active" : "nav"}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="acting-as">
          <span className="acting-label">Signed in as</span>
          <div className="user-name">{user?.name}</div>
          <button className="btn ghost sm block" onClick={logout}>
            Sign out
          </button>
        </div>
        <div className="sidebar-foot">
          <span className={`dot ${db === "up" ? "ok" : db === "down" ? "bad" : ""}`} />
          API {db === "…" ? "checking…" : db}
        </div>
      </aside>
      <main className="content">{children}</main>

      <button
        className="calc-fab"
        onClick={() => setCalcOpen((o) => !o)}
        title="Calculator"
        aria-label="Calculator"
        data-learn={`Calculator — quick maths on any page

A pop-up calculator you can open anywhere. It handles the tricky inventory maths for you:

• Convert packs to base units (cases → bottles → ml).
• Work out value and profit margin.
• Compute a stocktake variance (counted vs expected).

Open it whenever you need a number without leaving the page.`}
        data-learn-tl={`Calculator — mabilis na kuwenta sa kahit anong page

Pop-up calculator na pwedeng buksan kahit saan. Siya na ang bahala sa mahirap na inventory math:

• I-convert ang packs papuntang base units (cases → bottles → ml).
• Kuwentahin ang value at profit margin.
• Kuwentahin ang stocktake variance (binilang vs inaasahan).

Buksan tuwing kailangan ng numero nang hindi umaalis sa page.`}
      >
        🧮
      </button>
      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
      <LearnLayer />
    </div>
  );
}
