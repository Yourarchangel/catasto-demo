"use client";
// The demo bar sits outside the product on purpose: dark, dashed, monospace.
// It switches seats, plays the other side, resets the household and starts the tour.
// It exists only in the demo environment and never ships in the pilot build.
import { useEffect, useRef, useState } from "react";
import { Mail, MessageSquareText, Play, RotateCcw, Smartphone, Sparkles, Map as MapIcon, Monitor } from "lucide-react";
import type { PersonId, Role } from "@/lib/demo/types";
import { onOutbox, resetDemo, useHousehold } from "@/lib/demo/store";
import { availableReplies } from "@/lib/demo/simulate";
import { clearFiles } from "@/lib/demo/files";
import { FOLDERS, PEOPLE } from "@/lib/demo/seed";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUi } from "./ui-state";
import { cn } from "@/lib/utils";

export const DEMO_H = 84;

const SEATS: { role: Role; key: string; who: string; label: string }[] = [
  { role: "planner", key: "1", who: "Elena Brooks", label: "Planner" },
  { role: "cpa", key: "2", who: "Gary Lindholm", label: "CPA" },
  { role: "attorney", key: "3", who: "Rebecca Thorne", label: "Attorney" },
  { role: "client", key: "4", who: "The Harpers", label: "Client" },
];

function useCaption() {
  const s = useHousehold();
  const { ui, me } = useUi();
  if (ui.seat === "client") return `Viewing as ${PEOPLE[me].name}, on a phone. The clients hold every permission.`;
  const m = s.members[me as "elena"];
  const who = `Viewing as ${PEOPLE[me].name}, ${PEOPLE[me].title}.`;
  if (m.status !== "approved") return `${who} No access until the Harpers approve.`;
  const names = m.folders.map((f) => FOLDERS.find((x) => x.id === f)?.name);
  return `${who} Sees ${m.folders.length === 4 ? "every folder" : `the ${names.join(" and ")} folder only`}, because the Harpers chose that.`;
}

export function DemoBar() {
  const s = useHousehold();
  const { ui, set, go, reset, me } = useUi();
  const caption = useCaption();
  const replies = availableReplies(s, me);
  const [confirmReset, setConfirmReset] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  // Keys 1 to 4 switch seats, unless you are typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true], [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const seat = SEATS.find((x) => x.key === e.key);
      if (seat) set({ seat: seat.role, convId: undefined });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  const run = (id: string) => {
    const r = replies.find((x) => x.id === id);
    if (!r) return;
    setPlaying(r.label);
    setTimeout(() => {
      r.run();
      setPlaying(null);
    }, 700);
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 border-b-2 border-dashed border-demo-line bg-demo font-mono text-demo-ink"
      style={{ height: DEMO_H, fontSize: 12 }}
      role="region"
      aria-label="Demo controls, not part of Catasto"
    >
      <div className="flex h-[52px] items-center gap-2 overflow-x-auto px-3">
        <span className="shrink-0 rounded border border-dashed border-demo-line px-1.5 py-0.5 text-[11px] text-demo-line">Demo</span>
        <div className="flex shrink-0 rounded-md border border-demo-ink/25 p-0.5" role="radiogroup" aria-label="View as" data-tour="seats">
          {SEATS.map((x) => {
            const on = ui.seat === x.role;
            return (
              <button
                key={x.role}
                role="radio"
                aria-checked={on}
                onClick={() => set({ seat: x.role, convId: undefined })}
                className={cn("flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px]", on ? "bg-demo-line font-semibold text-demo" : "hover:bg-demo-ink/10")}
                data-tour={`seat-${x.role}`}
              >
                <span className={cn("rounded border px-1 text-[10px]", on ? "border-demo/40" : "border-demo-ink/30 opacity-70")}>{x.key}</span>
                <span className="hidden sm:inline">{x.who}</span>
                <span className="sm:hidden">{x.label}</span>
                <span className={cn("hidden lg:inline", on ? "opacity-70" : "opacity-50")}>{x.label}</span>
              </button>
            );
          })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex shrink-0 items-center gap-1.5 rounded-md border border-demo-line/70 px-2.5 py-1.5 text-[12px] hover:bg-demo-ink/10 disabled:opacity-50" disabled={!!playing} data-tour="simulate">
              <Sparkles className="size-3.5" aria-hidden />
              Simulate a reply
              <span className="rounded bg-demo-line px-1 text-[10px] font-semibold text-demo">{replies.length}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[24rem] border-dashed border-demo-line bg-demo font-mono text-demo-ink" style={{ fontSize: 12 }}>
            <p className="px-2 py-1.5 text-[11px] opacity-70">Play what the other side would do next. Same rules as the real thing.</p>
            {replies.length === 0 && <p className="px-2 py-3 text-[12px] opacity-70">Nothing to simulate right now. Act in this seat, or switch seats.</p>}
            {replies.map((r) => (
              <DropdownMenuItem key={r.id} onSelect={() => run(r.id)} className="flex-col items-start gap-0.5 focus:bg-demo-ink/10 focus:text-demo-ink">
                <span className="text-[12px] font-medium">{r.label}</span>
                <span className="text-[11px] opacity-60">{r.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button onClick={() => window.dispatchEvent(new CustomEvent("catasto:intro"))} className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-demo-ink/10 lg:flex">
          <Sparkles className="size-3.5" aria-hidden /> Intro
        </button>
        <button onClick={() => set({ tour: 0 })} className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-demo-ink/10" data-tour="take-tour">
          <MapIcon className="size-3.5" aria-hidden /> Take the tour
        </button>
        {ui.seat === "client" && (
          <button onClick={() => set({ phoneFrame: !ui.phoneFrame })} className="hidden shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-demo-ink/10 md:flex" aria-pressed={ui.phoneFrame}>
            {ui.phoneFrame ? <Monitor className="size-3.5" aria-hidden /> : <Smartphone className="size-3.5" aria-hidden />}
            {ui.phoneFrame ? "Full width" : "Phone frame"}
          </button>
        )}
        <div className="flex-1" />
        <button onClick={() => setConfirmReset(true)} className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-demo-ink/10">
          <RotateCcw className="size-3.5" aria-hidden /> Reset demo
        </button>
      </div>
      <p className="flex h-[30px] items-center gap-2 truncate border-t border-demo-ink/10 px-3 text-[11.5px] opacity-85" aria-live="polite">
        {playing ? (
          <>
            <Play className="size-3 animate-pulse" aria-hidden /> Simulating: {playing}
          </>
        ) : (
          caption
        )}
      </p>
      <Outbox />
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
            <DialogDescription>Anything you added is removed. Start the five-step flow from zero, or load a household that is already in use to explore every screen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
                        <Button
              variant="outline"
              onClick={() => {
                resetDemo("working");
                clearFiles();
                reset();
                go("home");
                setConfirmReset(false);
              }}
            >
              Load a working household
            </Button>
            <Button
              onClick={() => {
                resetDemo("zero");
                clearFiles();
                reset();
                go("home");
                setConfirmReset(false);
              }}
            >
              Start the five-step flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// What each person was just sent, shown in demo style so viewers see how little a notification reveals.
function Outbox() {
  const [items, setItems] = useState<{ id: number; to: PersonId[] }[]>([]);
  const n = useRef(0);
  useEffect(
    () =>
      onOutbox((to) => {
        const id = ++n.current;
        setItems((x) => [...x.slice(-1), { id, to }]);
        setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
      }),
    [],
  );
  if (!items.length) return null;
  return (
    <ul className="pointer-events-none fixed bottom-4 left-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] space-y-2" aria-live="polite" aria-label="Notifications sent">
      {items.map((i) => (
        <li key={i.id} className="push-in rounded-md border-2 border-dashed border-demo-line bg-demo px-3 py-2 font-mono text-[11.5px] text-demo-ink shadow-lg">
          <span className="flex items-center gap-1.5 opacity-70">
            <Smartphone className="size-3" aria-hidden />
            <MessageSquareText className="size-3" aria-hidden />
            <Mail className="size-3" aria-hidden />
            Sent to {i.to.map((p) => PEOPLE[p].first).join(", ")}
          </span>
          <span className="mt-0.5 block">&ldquo;You have something waiting.&rdquo; No client details.</span>
        </li>
      ))}
    </ul>
  );
}
