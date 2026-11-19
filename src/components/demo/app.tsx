"use client";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { DemoState, Household, Role } from "@/lib/core/types";
import { ROLE_LABEL, ROLES } from "@/lib/core/types";
import { openHousehold, setView, startPart, useDemo } from "@/lib/core/api";
import { isJoined, pendingRequests } from "@/lib/core/rules";
import { AdviserSignIn, ClientConsent, JoinFlow } from "./auth";
import { HouseholdList } from "./households";
import { FilesTab } from "./files";
import { MessagesTab } from "./messages";
import { AccessTab } from "./access";
import { TeamTab } from "./team";
import { Logo } from "./ui";
import { cn } from "@/lib/utils";

// The one line of guidance in Part 1: what to do next. Nothing else.
function hint(s: DemoState): string {
  if (s.part === 2) return "Everyone is set up. Upload, share, approve and message from any view.";
  if (s.adviserAuth !== "in") return "Click the fields to fill them in.";
  const h = s.households[0];
  if (!h) return "Create a household.";
  const st = (r: Role) => h.members[r].status;
  if (st("client") === "none") return "Open the household and invite the Client from Team.";
  if (st("client") === "invited") return "Switch to Client to accept the invite.";
  if (!h.consent) return "As the Client, sign the consent.";
  if (st("cpa") === "none" || st("attorney") === "none") return "As the Adviser, invite the CPA and the Attorney.";
  if (st("cpa") === "invited") return "Switch to CPA to accept the invite.";
  if (st("attorney") === "invited") return "Switch to Attorney to accept the invite.";
  return "Setup is done. Try uploading, requesting access, approving and messaging.";
}

function DemoBar({ s }: { s: DemoState }) {
  return (
    <div className="sticky top-0 z-40 flex h-9 items-center gap-1.5 bg-foreground px-2 text-[0.75rem] text-background sm:gap-3 sm:px-3">
      <span className="hidden font-semibold tracking-wide sm:inline">DEMO</span>
      {([1, 2] as const).map((p) => (
        <button key={p} onClick={() => startPart(p)} className={cn("shrink-0 rounded px-2 py-1", s.part === p ? "bg-background text-foreground" : "hover:bg-background/15")}>
          <span className="sm:hidden">Part {p}</span>
          <span className="hidden sm:inline">{p === 1 ? "Part 1: Onboarding" : "Part 2: Daily work"}</span>
        </button>
      ))}
      <span className="hidden min-w-0 flex-1 truncate text-center text-background/70 md:block">{hint(s)}</span>
      <span className="flex-1 md:hidden" />
      <div className="flex shrink-0 items-center gap-0.5 rounded border border-background/30 p-0.5" role="group" aria-label="View as">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setView(r)} aria-pressed={s.view === r} className={cn("rounded px-1.5 py-0.5 text-[0.7rem]", s.view === r ? "bg-background text-foreground" : "hover:bg-background/15")}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Header({ me }: { me: Role }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Logo />
        <span className="text-[0.8rem] text-muted-foreground">Signed in as {ROLE_LABEL[me]}</span>
      </div>
    </header>
  );
}

type Tab = "files" | "messages" | "team" | "access";

function HouseholdView({ h, me, back }: { h: Household; me: Role; back: boolean }) {
  const [tab, setTab] = useState<Tab>("files");
  const tabs: [Tab, string, number?][] = [["files", "Files"], ["messages", "Messages"]];
  if (me === "adviser") tabs.push(["team", "Team"]);
  if (me === "client") tabs.push(["access", "Access", pendingRequests(h).length]);
  const cur = tabs.some((t) => t[0] === tab) ? tab : "files";
  return (
    <div>
      {back && (
        <button onClick={() => openHousehold(undefined)} className="mb-4 inline-flex items-center gap-1.5 text-[0.8rem] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> Households
        </button>
      )}
      <h1 className="font-display text-[2.4rem] leading-none tracking-tight">{h.name}</h1>
      <nav className="mt-6 mb-6 flex gap-6 border-b" aria-label="Household">
        {tabs.map(([t, label, n]) => (
          <button key={t} onClick={() => setTab(t)} aria-current={cur === t ? "page" : undefined} className={cn("-mb-px border-b-2 pb-2.5 text-sm", cur === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
            {!!n && <span className="ml-1.5 rounded-full bg-foreground px-1.5 text-[0.68rem] text-background">{n}</span>}
          </button>
        ))}
      </nav>
      {cur === "files" && <FilesTab h={h} me={me} />}
      {cur === "messages" && <MessagesTab h={h} me={me} />}
      {cur === "team" && <TeamTab h={h} me={me} />}
      {cur === "access" && <AccessTab h={h} />}
    </div>
  );
}

function Screen({ s }: { s: DemoState }) {
  const me = s.view;
  if (me === "adviser" && s.adviserAuth !== "in") return <AdviserSignIn step={s.adviserAuth} />;
  const mine = me === "adviser" ? s.households : s.households.filter((h) => isJoined(h, me));
  if (me !== "adviser" && mine.length === 0) {
    const invited = s.households.find((h) => h.members[me].status === "invited");
    if (invited) return <JoinFlow key={`${invited.id}-${me}`} h={invited} role={me} />;
    return (
      <div className="flex min-h-[calc(100vh-2.25rem)] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <Logo className="mb-6" />
          <p className="text-sm text-muted-foreground">No invite yet for the {ROLE_LABEL[me]}. The Adviser sends one from a household&apos;s Team tab.</p>
        </div>
      </div>
    );
  }
  if (me === "client" && mine[0] && !mine[0].consent) return <ClientConsent h={mine[0]} />;
  // the adviser picks from a list; everyone else sees their household directly when they have one
  const open = mine.find((h) => h.id === s.openHouseholdId) ?? (me !== "adviser" && mine.length === 1 ? mine[0] : undefined);
  return (
    <>
      <Header me={me} />
      <main className="mx-auto max-w-5xl px-5 py-10">{open ? <HouseholdView key={`${open.id}-${me}`} h={open} me={me} back={me === "adviser" || mine.length > 1} /> : <HouseholdList role={me} households={s.households} />}</main>
    </>
  );
}

export default function DemoApp() {
  const s = useDemo();
  return (
    <div className="min-h-screen">
      <DemoBar s={s} />
      <Screen s={s} />
    </div>
  );
}
