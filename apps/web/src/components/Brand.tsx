const TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

/** Monochrome mark (inherits color via currentColor) — gear + magnifier + check. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g fill="currentColor">
        {TEETH.map((a) => (
          <rect
            key={a}
            x="21"
            y="1.5"
            width="6"
            height="8"
            rx="1.5"
            transform={`rotate(${a} 24 24)`}
          />
        ))}
      </g>
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="6" fill="none" />
      <circle cx="22" cy="22" r="8.5" stroke="currentColor" strokeWidth="3" fill="none" />
      <line
        x1="28.2"
        y1="28.2"
        x2="35"
        y2="35"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M17.8 22 l3 3 l5.6 -6.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Logo lockup: mark + InvenTrack Solutions wordmark. */
export function Brand({ variant = "sidebar" }: { variant?: "sidebar" | "login" }) {
  return (
    <div className={`brandmark ${variant}`}>
      <LogoMark size={variant === "login" ? 44 : 30} />
      <div className="brand-text">
        <div className="brand-name">
          Inven<span>Track</span>
        </div>
        <div className="brand-sub">Solutions</div>
      </div>
    </div>
  );
}
