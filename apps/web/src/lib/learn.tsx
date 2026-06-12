import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";

export type LearnLang = "en" | "tl";

/**
 * Click-based learning mode. When enabled, every element tagged with
 * `data-learn` (English) / `data-learn-tl` (Tagalog) highlights; clicking it
 * shows an explanation. The popover's "Continue" then performs the element's
 * real action (so people read, then keep navigating normally). Toggled from
 * Settings; language switchable in the banner.
 */
interface LearnCtx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  lang: LearnLang;
  setLang: (l: LearnLang) => void;
}

const Ctx = createContext<LearnCtx | null>(null);

export function LearnProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [lang, setLangState] = useState<LearnLang>(
    () => (localStorage.getItem("learnLang") as LearnLang) || "en",
  );
  const setLang = (l: LearnLang) => {
    setLangState(l);
    localStorage.setItem("learnLang", l);
  };

  useEffect(() => {
    api
      .settings()
      .then((s) => setEnabled(s.tutorialEnabled))
      .catch(() => undefined);
  }, []);

  return (
    <Ctx.Provider value={{ enabled, setEnabled, lang, setLang }}>{children}</Ctx.Provider>
  );
}

export function useLearn(): LearnCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLearn used outside LearnProvider");
  return ctx;
}

interface Pop {
  text: string;
  x: number;
  y: number;
  el: HTMLElement;
}

const T = {
  en: { hint: "Learning mode — click any highlighted element to learn what it does.", cont: "Continue →", off: "Turn off" },
  tl: { hint: "Learning mode — i-click ang anumang naka-highlight para malaman ang gamit.", cont: "Magpatuloy →", off: "Isara" },
};

export function LearnLayer() {
  const { enabled, setEnabled, lang, setLang } = useLearn();
  const [pop, setPop] = useState<Pop | null>(null);
  const bypassRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.body.classList.toggle("learn-on", enabled);
    if (!enabled) {
      setPop(null);
      return;
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Let the popover/banner controls work normally.
      if (target.closest(".learn-pop, .learn-banner")) return;
      const el = target.closest<HTMLElement>("[data-learn]");
      // A "Continue" pass-through: let the element's real action happen once.
      if (el && bypassRef.current === el) {
        bypassRef.current = null;
        return;
      }
      if (!el) {
        setPop(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const text =
        (lang === "tl" ? el.getAttribute("data-learn-tl") : el.getAttribute("data-learn")) ??
        el.getAttribute("data-learn") ??
        "";
      const r = el.getBoundingClientRect();
      setPop({ text, x: r.left + r.width / 2, y: r.bottom, el });
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.body.classList.remove("learn-on");
    };
  }, [enabled, lang]);

  if (!enabled) return null;

  function proceed() {
    const el = pop?.el;
    setPop(null);
    if (el) {
      bypassRef.current = el;
      el.click(); // re-runs the real action (navigate / submit / etc.)
    }
  }
  function turnOff() {
    setEnabled(false);
    api.updateSettings({ tutorialEnabled: false }).catch(() => undefined);
  }

  const t = T[lang];

  return (
    <>
      <div className="learn-banner">
        <span>🎓 {t.hint}</span>
        <button onClick={() => setLang(lang === "en" ? "tl" : "en")}>
          {lang === "en" ? "Tagalog" : "English"}
        </button>
        <button onClick={turnOff}>{t.off}</button>
      </div>
      {pop && (
        <>
          <div className="learn-pop-backdrop" onClick={() => setPop(null)} />
          <div
            className="learn-pop"
            style={{
              left: Math.max(8, Math.min(pop.x - 130, window.innerWidth - 270)),
              top: pop.y + 10,
            }}
          >
            {pop.text}
            <div className="learn-pop-actions">
              <button className="learn-continue" onClick={proceed}>
                {t.cont}
              </button>
            </div>
            <button className="learn-pop-x" onClick={() => setPop(null)} aria-label="Close">
              ×
            </button>
          </div>
        </>
      )}
    </>
  );
}
