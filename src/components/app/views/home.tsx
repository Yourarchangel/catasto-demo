"use client";
import { useState } from "react";
import { ArrowUpRight, FileText, Home as HomeIcon, MessageSquare, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { View } from "@/lib/demo/types";
import { addHousehold, pendingFor, unread, useHousehold } from "@/lib/demo/store";
import { FOLDERS, PEOPLE } from "@/lib/demo/seed";
import { RULE, heldFiles, isActive, isClient, visibleFiles } from "@/lib/demo/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, RuleLine } from "../bits";
import { ConsentCard } from "./consent";
import { useUi } from "../ui-state";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// The three core features, highlighted. No extra words.
function CoreTiles() {
  const s = useHousehold();
  const { me, go } = useUi();
  const counts: Partial<Record<View, number>> = { messages: unread(s, me), consent: pendingFor(s, me).length, files: heldFiles(s, me).length };
  const tiles: [string, React.ElementType, View][] = [
    ["File Sharing", FileText, "files"],
    ["Secure Message", MessageSquare, "messages"],
    ["Consent Management", ShieldCheck, "consent"],
  ];
  return (
    <div className="grid gap-5 @2xl:grid-cols-3" aria-label="Core features" data-tour="core-tiles">
      {tiles.map(([label, Icon, view]) => (
        <button
          key={label}
          onClick={() => go(view)}
          className="ink ink-glow group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-brand/70 p-5 text-left @2xl:min-h-[13.5rem] @2xl:flex-col @2xl:items-stretch @2xl:justify-between @2xl:gap-0 @2xl:p-6 shadow-[0_0_0_4px_var(--brand-soft),0_0_32px_var(--brand-soft)] transition-transform duration-300 hover:-translate-y-1"
        >
          <span className="flex shrink-0 items-start justify-between @2xl:w-full">
            <span className="flex size-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white">
              <Icon className="size-5" aria-hidden />
            </span>
            {!!counts[view] && <span className="rounded-full bg-brand px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--ink)]">{counts[view]}</span>}
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3 @2xl:w-full @2xl:flex-none @2xl:items-end">
            <span className="font-display text-[1.7rem] leading-[0.98] text-white @2xl:text-[2.1rem]">{label}</span>
            <ArrowUpRight className="size-5 shrink-0 text-white/40 transition-colors group-hover:text-brand" aria-hidden />
          </span>
        </button>
      ))}
    </div>
  );
}

function AddHousehold() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ink ink-glow relative flex flex-col items-start gap-6 rounded-2xl p-10">
        <HomeIcon className="size-7 text-white/80" aria-hidden />
        <div>
          <p className="font-display text-[2.6rem] leading-none text-white">No households yet</p>
          <p className="mt-3 max-w-[48ch] text-[0.95rem] text-white/65">Add a household and invite the clients. You see nothing until they approve you.</p>
        </div>
        <Button size="lg" onClick={() => setOpen(true)} data-tour="add-household" className="bg-white text-[var(--ink)] hover:bg-white/90">
          <UserPlus aria-hidden /> Add a household
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a household</DialogTitle>
            <DialogDescription>The clients get an invitation by email and text.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="hh-name">Household</Label>
              <Input id="hh-name" defaultValue="The Harper household" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hh-c1">Client</Label>
                <Input id="hh-c1" defaultValue="priya@harper.example" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hh-c2">Client</Label>
                <Input id="hh-c2" defaultValue="daniel@harper.example" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                addHousehold();
                setOpen(false);
                toast.success("Invitation sent", { description: "Daniel and Priya decide what you can see." });
              }}
            >
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProHome() {
  const s = useHousehold();
  const { me } = useUi();
  const p = PEOPLE[me];
  const active = isActive(s, me);
  const planner = me === "elena";
  return (
    <div>
      <PageHeader eyebrow={p.firm} title={`${greeting()}, ${p.first}.`} lead={active ? `${s.household.name}, ${s.household.city}.` : undefined} />
      {active ? (
        <div className="space-y-6">
          <CoreTiles />
          {!planner && (
            <p className="text-sm text-muted-foreground">
              The Harpers shared {s.members[me as "gary"].folders.map((f) => FOLDERS.find((x) => x.id === f)?.name).join(" and ")} with you. {visibleFiles(s, me).length} files.
            </p>
          )}
        </div>
      ) : planner && s.household.status === "none" ? (
        <AddHousehold />
      ) : (
        <div className="panel space-y-3 p-8" data-tour="waiting">
          <p className="font-display text-[1.8rem] leading-none">{planner ? "Waiting for Daniel and Priya" : "No households yet"}</p>
          <p className="text-sm text-muted-foreground">{planner ? "They have your invitation. Until they approve you, you see nothing in this household." : "When a client invites you, the household shows up here with only the folders they chose."}</p>
          <RuleLine text={RULE.regsp.line} />
        </div>
      )}
    </div>
  );
}

export function ClientHome() {
  const s = useHousehold();
  const { me, go } = useUi();
  const pending = pendingFor(s, me);
  const team = (["elena", "gary", "rebecca"] as const).filter((p) => s.members[p].status === "approved");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[2.2rem] leading-none">Hi, {PEOPLE[me].first}</h1>
        <p className="mt-1 text-muted-foreground">{pending.length ? `${pending.length} ${pending.length === 1 ? "thing needs" : "things need"} you.` : "Nothing needs you right now."}</p>
      </div>
      {s.household.status !== "active" ? (
        <div className="panel p-5 text-sm text-muted-foreground">When your planner invites you, it shows up here.</div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-[1.5rem] leading-none">For you to approve</h2>
              {pending.map((c) => (
                <ConsentCard key={c.id} c={c} />
              ))}
            </section>
          )}
          <section className="space-y-3">
            <h2 className="font-display text-[1.5rem] leading-none">Your team</h2>
            <div className="panel divide-y">
              {team.length === 0 && <p className="p-4 text-sm text-muted-foreground">No one yet.</p>}
              {team.map((p) => (
                <p key={p} className="flex justify-between gap-2 p-4 text-sm">
                  <span className="font-medium">
                    {PEOPLE[p].name}, {PEOPLE[p].title}
                  </span>
                  <span className="text-muted-foreground">{s.members[p].folders.length === 4 ? "All folders" : s.members[p].folders.map((f) => FOLDERS.find((x) => x.id === f)?.name).join(", ")}</span>
                </p>
              ))}
            </div>
            {isActive(s, "elena") && (
              <Button variant="outline" className="w-full" onClick={() => go("consent")} data-tour="client-invite">
                <UserPlus aria-hidden /> Invite your CPA or attorney
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function HomeView() {
  const { me } = useUi();
  return isClient(me) ? <ClientHome /> : <ProHome />;
}
