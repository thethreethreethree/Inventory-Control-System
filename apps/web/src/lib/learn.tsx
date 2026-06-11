import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

/**
 * Click-based learning mode. When enabled, every element tagged with a
 * `data-learn="…"` attribute highlights, and clicking it shows an explanation
 * instead of performing its action. Toggled from the Settings page.
 */
interface LearnCtx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

const Ctx = createContext<LearnCtx | null>(null);

export function LearnProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    api
      .settings()
      .then((s) => setEnabled(s.tutorialEnabled))
      .catch(() => undefined);
  }, []);
  return <Ctx.Provider value={{ enabled, setEnabled }}>{children}</Ctx.Provider>;
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
}

/** Overlay that intercepts clicks on learnable elements and explains them. */
export function LearnLayer() {
  const { enabled, setEnabled } = useLearn();
  const [pop, setPop] = useState<Pop | null>(null);

  useEffect(() => {
    document.body.classList.toggle("learn-on", enabled);
    if (!enabled) {
      setPop(null);
      return;
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-learn]");
      if (!el) {
        setPop(null);
        return;
      }
      // Explain instead of act.
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      setPop({
        text: el.getAttribute("data-learn") ?? "",
        x: r.left + r.width / 2,
        y: r.bottom,
      });
    }
    document.addEventListener("click", onClick, true); // capture phase, before React
    return () => {
      document.removeEventListener("click", onClick, true);
      document.body.classList.remove("learn-on");
    };
  }, [enabled]);

  if (!enabled) return null;

  function turnOff() {
    setEnabled(false);
    api.updateSettings({ tutorialEnabled: false }).catch(() => undefined);
  }

  return (
    <>
      <div className="learn-banner">
        <span>🎓 Learning mode — click any highlighted element to learn what it does.</span>
        <button onClick={turnOff}>Turn off</button>
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
            <button className="learn-pop-x" onClick={() => setPop(null)} aria-label="Close">
              ×
            </button>
          </div>
        </>
      )}
    </>
  );
}
