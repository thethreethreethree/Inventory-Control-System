"use client";
/**
 * Official InvenTrack Solutions lockups (from the brand asset kit).
 * - sidebar: the reversed (white-on-navy) horizontal lockup, which blends into
 *   the navy sidebar.
 * - login: the stacked lockup on the white sign-in card.
 */
export function Brand({ variant = "sidebar" }: { variant?: "sidebar" | "login" }) {
  if (variant === "login") {
    return (
      <img
        className="brand-img-login"
        src="/brand/logo-stacked.png"
        alt="InvenTrack Solutions"
        width={210}
      />
    );
  }
  return (
    <div className="brand-side">
      <img
        className="brand-img-side"
        src="/brand/logo-reversed.png"
        alt="InvenTrack Solutions"
        width={188}
      />
    </div>
  );
}
