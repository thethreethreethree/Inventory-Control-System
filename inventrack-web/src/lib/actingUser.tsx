"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearAuthToken, getAuthToken, setAuthToken } from "../api/client";
import { Login } from "../components/Login";

/**
 * Auth context. The provider gates the whole app: it renders <Login> until a
 * valid session exists, then exposes the signed-in user + their permissions.
 * (Named ActingUserProvider/useActingUser for continuity with the pages that
 * consume `userId`.)
 */
interface AuthCtx {
  userId: string | null;
  user: { id: string; name: string } | null;
  permissions: Set<string>;
  can: (perm: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function ActingUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [authed, setAuthed] = useState<boolean>(() => Boolean(getAuthToken()));
  const [loading, setLoading] = useState<boolean>(Boolean(getAuthToken()));

  useEffect(() => {
    if (!authed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .me()
      .then((m) => {
        setUser(m.user);
        setPermissions(new Set(m.permissions));
      })
      .catch(() => {
        clearAuthToken();
        setAuthed(false);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [authed]);

  async function onLogin(email: string, password: string) {
    const res = await api.login(email, password);
    setAuthToken(res.token);
    setAuthed(true);
  }

  function logout() {
    clearAuthToken();
    setUser(null);
    setPermissions(new Set());
    setAuthed(false);
  }

  if (loading) {
    return (
      <div className="login-wrap">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!authed || !user) {
    return <Login onSubmit={onLogin} />;
  }

  return (
    <Ctx.Provider
      value={{
        userId: user.id,
        user,
        permissions,
        can: (perm) => permissions.has(perm),
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useActingUser(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActingUser used outside ActingUserProvider");
  return ctx;
}
