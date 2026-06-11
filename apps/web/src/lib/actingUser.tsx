import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { User } from "../api/types";

/**
 * Stand-in for authentication until the auth phase: a globally selected "acting"
 * user. Actions attribute to this user, so separation-of-duties flows work
 * (switch to Manager to approve what Admin requested).
 */
interface ActingUserCtx {
  users: User[];
  userId: string | null;
  user: User | null;
  setUserId: (id: string) => void;
}

const Ctx = createContext<ActingUserCtx | null>(null);

export function ActingUserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserIdState] = useState<string | null>(() =>
    localStorage.getItem("actingUserId"),
  );

  useEffect(() => {
    api
      .users()
      .then((u) => {
        setUsers(u);
        setUserIdState((cur) => cur ?? u[0]?.id ?? null);
      })
      .catch(() => undefined);
  }, []);

  const setUserId = (id: string) => {
    setUserIdState(id);
    localStorage.setItem("actingUserId", id);
  };

  const user = users.find((u) => u.id === userId) ?? null;
  return <Ctx.Provider value={{ users, userId, user, setUserId }}>{children}</Ctx.Provider>;
}

export function useActingUser(): ActingUserCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActingUser used outside ActingUserProvider");
  return ctx;
}
