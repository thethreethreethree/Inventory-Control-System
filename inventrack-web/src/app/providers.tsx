"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ActingUserProvider } from "@/lib/actingUser";
import { LearnProvider } from "@/lib/learn";
import { AppShell } from "@/components/AppShell";

/**
 * Client root. This is a client-rendered dashboard (it reads the session token
 * from localStorage), so we gate the whole tree behind a mount check — the
 * server renders a neutral splash and the real app hydrates on the client,
 * which avoids any window/localStorage access during SSR.
 *
 * ActingUserProvider then gates on auth — it shows the Login screen until a
 * valid session exists, after which the AppShell (sidebar + nav) wraps the
 * active page. LearnProvider powers the click-to-learn tutorial overlay.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="login-wrap">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <ActingUserProvider>
      <LearnProvider>
        <AppShell>{children}</AppShell>
      </LearnProvider>
    </ActingUserProvider>
  );
}
