"use client";
import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import type { DemoState, Household, Role } from "@/lib/core/types";
import { ROLE_LABEL, ROLES } from "@/lib/core/types";
import { openHousehold, setAdviserSharing, setView, startPart, useDemo } from "@/lib/core/api";
import { isMine, pendingRequests } from "@/lib/core/rules";
import { AdviserSignIn, ClientConsent, JoinFlow } from "./auth";
import { HouseholdList } from "./households";
import { FilesTab } from "./files";
import { MessagesTab } from "./messages";
import { AccessTab } from "./access";
import { TeamTab } from "./team";
import { Logo, Modal, Switch } from "./ui";
import { cn } from "@/lib/utils";

// The one line of guidance in Part 1: what to do next. Nothing else.
function hint(s: DemoState): string {
  if (s.part === 2)
    return s.households.some((h) => h.members.cpa.status === "invited")
      ? "Everyone is set up. Switch to CPA to see more than one household and accept a new invite."
      : "Everyone is set up. Upload, share, approve and message from any view.";
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

function Header({ me, shares }: { me: Role; shares: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5">
        <Logo />
        <span className="flex items-center gap-3 text-[0.8rem] text-muted-foreground">
          Signed in as {ROLE_LABEL[me]}
          {me === "adviser" && (
            <button onClick={() => setOpen(true)} aria-label="Settings" className="rounded-md p-1.5 text-foreground transition-colors hover:bg-muted">
              <Settings className="size-4" aria-hidden />
            </button>
          )}
        </span>
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Settings" desc="Applies to every household.">
          <div className="flex items-center gap-4 rounded-lg border p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Share my workspace with the team</p>
              <p className="text-[0.8rem] text-muted-foreground">{shares ? "On: professionals the client approves can see your workspace. The client controls who." : "Off: your workspace is locked. Only you and the client can see it."}</p>
            </div>
            <Switch on={shares} label="Share my workspace with the team" onChange={setAdviserSharing} />
          </div>
          <p className="text-[0.75rem] text-muted-foreground">You can lock your own workspace. You can&apos;t give anyone access. That&apos;s always the client&apos;s choice.</p>
        </Modal>
      )}
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
          <button key={t} onClick={() => setTab(t)} aria-current={cur === t ? "page" : undefined} className={cn("-mb-px border-b-2 pb-2.5 text-sm transition-colors", cur === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
            {!!n && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[0.68rem] font-semibold text-foreground">{n}</span>}
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
  const mine = me === "adviser" ? s.households : s.households.filter((h) => isMine(h, me));
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
  // Advisers, CPAs and attorneys work with many households, so their home is the list.
  // A client usually has one, so they go straight in.
  const open = mine.find((h) => h.id === s.open[me]) ?? (me === "client" && mine.length === 1 ? mine[0] : undefined);
  return (
    <>
      <Header me={me} shares={s.adviserShares} />
      <main className="mx-auto max-w-5xl px-5 py-10">{open ? <HouseholdView key={`${open.id}-${me}`} h={open} me={me} back={me !== "client" || mine.length > 1} /> : <HouseholdList role={me} households={s.households} />}</main>
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
