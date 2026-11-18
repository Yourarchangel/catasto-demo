"use client";
// Who is looking, and where. Switching the demo seat never changes the household, only the view of it.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ClientId, FolderId, PersonId, Role, View } from "@/lib/demo/types";

export const ROLE_PERSON: Record<Exclude<Role, "client">, PersonId> = { planner: "elena", cpa: "gary", attorney: "rebecca" };

export interface UiState {
  seat: Role;
  clientActor: ClientId;
  view: View;
  convId?: string;
  folder?: FolderId | "all";
  phoneFrame: boolean;
  tour: number | null;
  tourDismissed: boolean;
}

const DEFAULT: UiState = { seat: "planner", clientActor: "priya", view: "home", phoneFrame: true, tour: null, tourDismissed: false, folder: "all" };
const KEY = "catasto-v11-ui";

interface Ctx {
  ui: UiState;
  set: (patch: Partial<UiState>) => void;
  go: (view: View, extra?: Partial<UiState>) => void;
  me: PersonId;
  reset: () => void;
}

const UiCtx = createContext<Ctx | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [ui, setUi] = useState<UiState>(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT, ...JSON.parse(raw), tour: null };
    } catch {
      /* ignore */
    }
    return DEFAULT;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(ui));
    } catch {
      /* ignore */
    }
  }, [ui]);
  useEffect(() => {
    document.documentElement.style.fontSize = ui.seat === "client" ? "17px" : "15px";
  }, [ui.seat]);
  const set = useCallback((patch: Partial<UiState>) => setUi((u) => ({ ...u, ...patch })), []);
  const go = useCallback((view: View, extra?: Partial<UiState>) => setUi((u) => ({ ...u, view, ...extra })), []);
  const reset = useCallback(() => setUi((u) => ({ ...DEFAULT, tourDismissed: true, phoneFrame: u.phoneFrame })), []);
  const me: PersonId = ui.seat === "client" ? ui.clientActor : ROLE_PERSON[ui.seat];
  const value = useMemo(() => ({ ui, set, go, me, reset }), [ui, set, go, me, reset]);
  return <UiCtx.Provider value={value}>{children}</UiCtx.Provider>;
}

export function useUi() {
  const c = useContext(UiCtx);
  if (!c) throw new Error("useUi outside UiProvider");
  return c;
}
