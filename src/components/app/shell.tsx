"use client";
// Four apps on one code base: a desktop app for the planner, CPA and attorney, and a phone app for the clients.
import { useEffect, useRef, useState } from "react";
import { Bell, FileText, Home, KeyRound, ListChecks, Mail, MessageSquare, ShieldCheck, UserRound } from "lucide-react";
import type { PersonId, View } from "@/lib/demo/types";
import { readNotices, signIn, unread, useHousehold, pendingFor } from "@/lib/demo/store";
import { PEOPLE } from "@/lib/demo/seed";
import { heldFiles, isActive } from "@/lib/demo/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, timeAgo } from "./bits";
import { useUi } from "./ui-state";
import { cn } from "@/lib/utils";

const NAV: { view: View; label: string; icon: React.ElementType }[] = [
  { view: "home", label: "Home", icon: Home },
  { view: "files", label: "Files", icon: FileText },
  { view: "messages", label: "Messages", icon: MessageSquare },
  { view: "consent", label: "Consent", icon: ShieldCheck },
  { view: "activity", label: "Activity", icon: ListChecks },
];

function useCounts(): Partial<Record<View, number>> {
  const s = useHousehold();
  const { me } = useUi();
  return { messages: unread(s, me), consent: pendingFor(s, me).length, files: heldFiles(s, me).length };
}

function Brand({ small }: { small?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/catasto-logo.svg" alt="Catasto" className={small ? "h-[18px] w-auto" : "h-6 w-auto"} />;
}

// ---------- secure sign-in: magic link plus a one-time code (simulated) ----------
export function SignInGate({ children }: { children: React.ReactNode }) {
  const s = useHousehold();
  const { me, ui } = useUi();
  const [step, setStep] = useState<"email" | "link" | "code">("email");
  const [code, setCode] = useState("");
  if (s.signedIn.includes(me)) return <>{children}</>;
  const p = PEOPLE[me];
  return (
    <div key={me} className={cn("view-in", ui.seat === "client" ? "flex justify-center px-1 py-4" : "grid min-h-[calc(100vh-var(--demo-h))] lg:grid-cols-[1.1fr_1fr]")}>
      {ui.seat !== "client" && (
        <div className="ink ink-glow relative hidden flex-col justify-between p-12 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/catasto-logo-white.svg" alt="Catasto" className="h-7 w-auto self-start" />
          <div>
            <p className="eyebrow text-white/50">For {p.title === "CFP" ? "planners" : p.title === "CPA" ? "CPAs" : "estate attorneys"}</p>
            <p className="mt-4 max-w-[16ch] font-display text-[3.4rem] leading-[0.98] tracking-[-0.015em] text-white">One client record for the whole planning team.</p>
          </div>
          <ul className="space-y-2.5 border-t border-[var(--ink-line)] pt-6 text-[0.85rem] text-white/65">
            <li>Clients approve every person and every folder.</li>
            <li>Tax returns wait for a signed 7216 form.</li>
            <li>Attorney files stay private until the clients say otherwise.</li>
          </ul>
        </div>
      )}
      <div className={cn(ui.seat !== "client" && "flex items-center justify-center px-4 py-16")}>
      <div className={cn("w-full max-w-sm", ui.seat === "client" ? "panel p-6" : "")} data-tour="signin">
        {ui.seat === "client" ? <Brand /> : <p className="eyebrow text-muted-foreground">{p.firm}</p>}
        <h1 className="mt-5 font-display text-[2.6rem] leading-none">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">No passwords. A link by email, then a code by text.</p>
        {step === "email" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setStep("link");
            }}
          >
            <Label htmlFor="signin-email">Email</Label>
            <Input id="signin-email" value={p.email} readOnly />
            <Button type="submit" className="w-full">
              <Mail aria-hidden /> Email me a sign-in link
            </Button>
          </form>
        )}
        {step === "link" && (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border bg-secondary p-4 text-sm">
              <p className="font-medium">Check your email</p>
              <p className="mt-1 text-muted-foreground">We sent a link to {p.email}. It works once and expires in 10 minutes.</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setStep("code");
                setCode("482913");
              }}
            >
              Open the link
            </Button>
          </div>
        )}
        {step === "code" && (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) signIn(me);
            }}
          >
            <Label htmlFor="signin-code">Code we texted to your phone</Label>
            <Input id="signin-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tabular tracking-[0.4em]" />
            <Button type="submit" className="w-full">
              <KeyRound aria-hidden /> Verify and sign in
            </Button>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}

// ---------- notifications: never any client details ----------
function Notifications() {
  const s = useHousehold();
  const { me, go } = useUi();
  const mine = s.notices.filter((n) => n.to === me).slice(0, 8);
  const count = mine.filter((n) => !n.read).length;
  return (
    <DropdownMenu onOpenChange={(o) => !o && readNotices(me)}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${count ? `, ${count} new` : ""}`} className="relative">
          <Bell aria-hidden />
          {count > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-background" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {mine.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing yet.</p>}
        {mine.map((n) => (
          <DropdownMenuItem key={n.id} onSelect={() => go(n.view)} className="flex-col items-start gap-0.5">
            <span className={cn("text-sm", !n.read && "font-semibold")}>You have something waiting</span>
            <span className="text-xs text-muted-foreground">Sign in to Catasto to see it. {timeAgo(n.at)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonMenu() {
  const { me, ui, set } = useUi();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent" >
          <Avatar id={me} size="sm" />
          <span className="hidden text-sm sm:inline">{PEOPLE[me].first}</span>
          <span className="sr-only">{PEOPLE[me].first}, account menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{PEOPLE[me].name}</p>
          <p className="text-xs text-muted-foreground">{PEOPLE[me].email}</p>
        </DropdownMenuLabel>
        {ui.seat === "client" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => set({ clientActor: ui.clientActor === "priya" ? "daniel" : "priya" })}>
              <UserRound aria-hidden /> Sign in as {ui.clientActor === "priya" ? "Daniel" : "Priya"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- professionals ----------
export function ProShell({ children }: { children: React.ReactNode }) {
  const s = useHousehold();
  const { ui, go, me } = useUi();
  const counts = useCounts();
  const active = isActive(s, me);
  const p = PEOPLE[me];
  return (
    <div className="flex min-h-[calc(100vh-var(--demo-h))]">
      <nav aria-label="Main" className="ink sticky top-[var(--demo-h)] hidden h-[calc(100vh-var(--demo-h))] w-60 shrink-0 flex-col px-3 pb-4 pt-5 md:flex">
        <div className="px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/catasto-logo-white.svg" alt="Catasto" className="h-6 w-auto" />
        </div>
        <div className="mx-3 mt-7 border-t border-[var(--ink-line)] pt-4">
          <p className="eyebrow text-white/45">{active ? "Household" : "Households"}</p>
          <p className="mt-1.5 font-display text-[1.35rem] leading-tight text-white">{active ? "The Harpers" : "None yet"}</p>
          {active && <p className="text-[0.75rem] text-white/50">{s.household.city}</p>}
        </div>
        <ul className="mt-6 space-y-0.5">
          {NAV.map((n) => {
            const on = ui.view === n.view;
            return (
              <li key={n.view}>
                <button
                  onClick={() => go(n.view)}
                  aria-current={on ? "page" : undefined}
                  data-tour={`nav-${n.view}`}
                  className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[0.92rem] transition-colors", on ? "bg-white/[0.08] text-white" : "text-white/70 hover:bg-white/[0.05] hover:text-white")}
                >
                  {on && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand" aria-hidden />}
                  <n.icon className="size-4" aria-hidden />
                  <span className="flex-1 text-left">{n.label}</span>
                  {!!counts[n.view] && <span className="tabular rounded-full bg-brand px-1.5 text-[0.7rem] font-semibold text-[var(--ink)]">{counts[n.view]}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto space-y-3 px-3">
          <div className="flex items-center gap-2.5 border-t border-[var(--ink-line)] pt-4">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-white text-[0.7rem] font-semibold text-[var(--ink)]">{p.initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-[0.85rem] text-white">{p.name}</span>
              <span className="block truncate text-[0.72rem] text-white/50">{p.firm}</span>
            </span>
          </div>
          <p className="text-[0.7rem] leading-snug text-white/55">Fictional household. Every name, number and document is invented.</p>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-[var(--demo-h)] z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-8">
          <span className="md:hidden">
            <Brand />
          </span>
          <p className="hidden truncate text-[0.85rem] text-muted-foreground sm:block">
            {p.firm} <span className="mx-1.5 text-border">/</span> <span className="text-foreground">{active ? s.household.name : "Households"}</span>
          </p>
          <div className="flex-1" />
          <span className="hidden items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[0.72rem] text-muted-foreground lg:inline-flex">
            <ShieldCheck className="size-3.5" aria-hidden /> Client-authorized
          </span>
          <Notifications />
          <PersonMenu />
        </header>
        <main id="main" tabIndex={-1} className="@container min-w-0 flex-1 overflow-x-clip px-4 py-8 pb-24 sm:px-10 md:pb-12">
          <div className="mx-auto max-w-[70rem]">{children}</div>
        </main>
      </div>
      <nav aria-label="Main" className="ink fixed inset-x-0 bottom-0 z-30 flex justify-around py-1.5 md:hidden">
        {NAV.map((n) => (
          <button key={n.view} onClick={() => go(n.view)} aria-current={ui.view === n.view ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 px-2 py-1 text-[0.68rem]", ui.view === n.view ? "text-white" : "text-white/60")}>
            <n.icon className="size-5" aria-hidden />
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---------- clients: built for a phone ----------
export function ClientShell({ children, signedIn }: { children: React.ReactNode; signedIn: boolean }) {
  const { ui } = useUi();
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const framed = ui.phoneFrame && wide;
  return (
    <div className={cn("flex justify-center", framed && "px-4 py-6")}>
      <div className={cn(framed ? "relative h-[min(52rem,calc(100vh-var(--demo-h)-3rem))] w-[24.5rem] max-w-full overflow-hidden rounded-[2.6rem] border-[10px] border-foreground/85 bg-background shadow-2xl" : "min-h-[calc(100vh-var(--demo-h))] w-full max-w-lg bg-background")}>
        <PhoneScreen framed={framed} signedIn={signedIn}>
          {children}
        </PhoneScreen>
      </div>
    </div>
  );
}

function PhoneScreen({ children, framed, signedIn }: { children: React.ReactNode; framed: boolean; signedIn: boolean }) {
  const s = useHousehold();
  const { ui, go, me } = useUi();
  const counts = useCounts();
  const [banner, setBanner] = useState<{ id: string; view: View } | null>(null);
  const last = useRef<string | undefined>(s.notices.find((n) => n.to === me)?.id);
  useEffect(() => {
    const latest = s.notices.find((n) => n.to === me);
    if (latest && latest.id !== last.current) {
      last.current = latest.id;
      const t0 = setTimeout(() => setBanner({ id: latest.id, view: latest.view }), 0);
      const t = setTimeout(() => setBanner(null), 3200);
      return () => {
        clearTimeout(t0);
        clearTimeout(t);
      };
    }
  }, [s.notices, me]);
  return (
    <div className="relative flex h-full flex-col">
      {framed && (
        <div className="ink relative flex h-8 shrink-0 items-center justify-between px-6 text-[0.72rem] font-semibold" aria-hidden>
          <span>9:41</span>
          <span className="h-5 w-24 rounded-full bg-black" />
          <span>5G</span>
        </div>
      )}
      {banner && (
        <button
          onClick={() => {
            go(banner.view);
            setBanner(null);
          }}
          className="push-in absolute inset-x-2.5 top-9 z-40 flex items-start gap-3 rounded-2xl border bg-popover/95 p-3 text-left shadow-xl backdrop-blur"
          role="status"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/catasto-app-icon.svg" alt="" className="size-9 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="flex justify-between text-[0.72rem] text-muted-foreground">
              <span>Catasto</span>
              <span>now</span>
            </span>
            <span className="block text-[0.9rem] font-semibold leading-snug">You have something waiting</span>
            <span className="block text-[0.8rem] text-muted-foreground">Open Catasto to see it.</span>
          </span>
        </button>
      )}
      <header className="ink relative flex shrink-0 items-center justify-between px-4 py-2.5 [&_button]:text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/catasto-logo-white.svg" alt="Catasto" className="h-[18px] w-auto" />
        {signedIn && (
          <div className="flex items-center gap-1">
            <Notifications />
            <PersonMenu />
          </div>
        )}
      </header>
      <main id="main" tabIndex={0} aria-label="Content" className="@container flex-1 overflow-y-auto px-4 py-5 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </main>
      {signedIn && (
        <nav aria-label="Main" className="grid shrink-0 grid-cols-5 border-t bg-background">
          {NAV.map((n) => {
            const on = ui.view === n.view;
            return (
              <button
                key={n.view}
                onClick={() => {
                  setBanner(null);
                  go(n.view, { convId: undefined });
                }} aria-current={on ? "page" : undefined} data-tour={`tab-${n.view}`} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem]", on ? "font-semibold text-foreground" : "text-muted-foreground")}>
                <n.icon className="size-5" aria-hidden />
                {n.label}
                {!!counts[n.view] && <span className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-primary px-1 text-[0.62rem] font-semibold text-primary-foreground">{counts[n.view]}</span>}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function useMe(): PersonId {
  return useUi().me;
}
