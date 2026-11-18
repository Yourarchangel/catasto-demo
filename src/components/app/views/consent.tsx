"use client";
import { useState } from "react";
import { Check, PenLine, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { ClientId, Consent, FolderId, ProId } from "@/lib/demo/types";
import { declineConsent, inviteMember, pendingFor, revokeMember, setFolders, signConsent, useHousehold } from "@/lib/demo/store";
import { ALL_FOLDERS, FOLDERS, PEOPLE, PROS } from "@/lib/demo/seed";
import { RULE, isActive, isClient } from "@/lib/demo/rules";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, PageHeader, RuleLine, Section, timeAgo } from "../bits";
import { NotYet } from "./files";
import { useUi } from "../ui-state";
import { cn } from "@/lib/utils";

const folderName = (f: FolderId) => FOLDERS.find((x) => x.id === f)?.name ?? f;

function Pill({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
      <span className={cn("size-1.5 rounded-full", on ? "bg-brand" : "bg-foreground")} />
      {children}
    </span>
  );
}

export function ConsentCard({ c }: { c: Consent }) {
  const { me } = useUi();
  const [agree, setAgree] = useState(false);
  const client = me as ClientId;
  const form = c.kind === "7216";
  return (
    <article className={cn("panel space-y-3 p-5", form && "ring-2 ring-brand")} data-tour="consent-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-[0.75rem] font-semibold">{RULE[c.rule].short}</span>
        <Pill>Waiting for you</Pill>
      </div>
      <h3 className="text-[1.1rem] font-semibold leading-snug">{c.title}</h3>
      <p className="text-[0.92rem] text-muted-foreground">{c.detail}</p>
      {c.folders && (
        <div className="flex flex-wrap gap-1.5">
          {c.folders.map((f) => (
            <span key={f} className="rounded-full border bg-secondary px-2.5 py-0.5 text-[0.8rem]">
              {folderName(f)}
            </span>
          ))}
        </div>
      )}
      <RuleLine text={RULE[c.rule].line} />
      {c.needsBoth && (
        <div className="flex gap-3 text-[0.8rem]">
          {(["priya", "daniel"] as ClientId[]).map((p) => (
            <span key={p} className="inline-flex items-center gap-1">
              {c.signatures[p] ? <Check className="size-3.5" aria-hidden /> : <PenLine className="size-3.5" aria-hidden />}
              {PEOPLE[p].first} {c.signatures[p] ? "signed" : "has not signed"}
            </span>
          ))}
        </div>
      )}
      {form && (
        <label className="flex items-start gap-2 rounded-lg border bg-secondary/60 p-3 text-[0.85rem]">
          <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" aria-label="I consent" />
          <span>I consent to Lindholm &amp; Associates sharing this tax return information with the people named above. This consent lasts one year and I can revoke it at any time.</span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="outline"
          onClick={() => {
            declineConsent(c.id, client);
            toast("Declined. Nothing was shared.");
          }}
        >
          <X aria-hidden /> Decline
        </Button>
        <Button
          disabled={form && !agree}
          onClick={() => {
            signConsent(c.id, client);
            toast.success(form ? `Signed as ${PEOPLE[client].first}` : "Approved", { description: "It is in the activity log." });
          }}
        >
          <Check aria-hidden /> {form ? `Sign as ${PEOPLE[client].first}` : "Approve"}
        </Button>
      </div>
    </article>
  );
}

function InviteDialog({ person, onClose }: { person: ProId; onClose: () => void }) {
  const { me } = useUi();
  const [pick, setPick] = useState<FolderId[]>(person === "gary" ? ["tax"] : person === "rebecca" ? ["estate"] : ALL_FOLDERS);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite {PEOPLE[person].name}</DialogTitle>
          <DialogDescription>
            {PEOPLE[person].title}, {PEOPLE[person].firm}. Pick the folders they may see. They see nothing else.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {ALL_FOLDERS.map((f) => (
            <label key={f} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox checked={pick.includes(f)} onCheckedChange={(c) => setPick((x) => (c ? [...x, f] : x.filter((y) => y !== f)))} />
              {folderName(f)}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={!pick.length}
            onClick={() => {
              inviteMember(me as ClientId, person, pick);
              toast.success(`${PEOPLE[person].first} was invited`, { description: "They get the app free and see only what you picked." });
              onClose();
            }}
          >
            <UserPlus aria-hidden /> Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamRow({ p }: { p: ProId }) {
  const s = useHousehold();
  const { me } = useUi();
  const [invite, setInvite] = useState(false);
  const m = s.members[p];
  const client = isClient(me);
  return (
    <li className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Avatar id={p} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {PEOPLE[p].name}, {PEOPLE[p].title}
          </p>
          <p className="text-[0.8rem] text-muted-foreground">{PEOPLE[p].firm}</p>
        </div>
        <Pill on={m.status === "approved"}>{m.status === "approved" ? "Approved" : m.status === "pending" ? "Waiting for you" : m.status === "revoked" ? "Removed" : "Not invited"}</Pill>
      </div>
      {m.status === "approved" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {ALL_FOLDERS.map((f) => {
            const on = m.folders.includes(f);
            return client ? (
              <button
                key={f}
                aria-pressed={on}
                onClick={() => setFolders(me as ClientId, p, on ? m.folders.filter((x) => x !== f) : [...m.folders, f])}
                className={cn("rounded-full border px-2.5 py-0.5 text-[0.8rem]", on ? "border-brand bg-brand-soft font-medium" : "text-muted-foreground")}
              >
                {folderName(f)}
              </button>
            ) : (
              on && (
                <span key={f} className="rounded-full border border-brand bg-brand-soft px-2.5 py-0.5 text-[0.8rem] font-medium">
                  {folderName(f)}
                </span>
              )
            );
          })}
        </div>
      )}
      {client && p !== "elena" && (m.status === "none" || m.status === "revoked") && (
        <Button size="sm" variant="outline" onClick={() => setInvite(true)} data-tour={`invite-${p}`}>
          <UserPlus aria-hidden /> Invite and pick folders
        </Button>
      )}
      {client && m.status === "approved" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            revokeMember(me as ClientId, p);
            toast(`${PEOPLE[p].first}'s access ended`, { description: "Immediately, for every folder and message." });
          }}
        >
          Remove access
        </Button>
      )}
      {invite && <InviteDialog person={p} onClose={() => setInvite(false)} />}
    </li>
  );
}

export function ConsentView() {
  const s = useHousehold();
  const { me } = useUi();
  const client = isClient(me);
  const pending = pendingFor(s, me);
  const waiting = s.consents.filter((c) => c.status === "pending" && (client ? c.signatures[me as ClientId] : c.requestedBy === me || c.shareWith?.includes(me)));
  const past = s.consents.filter((c) => c.status !== "pending").slice().reverse();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Consent Management" title={client ? "Who sees what" : "Your access"} lead={client ? "You approve every person and every folder. You can take access back at any time." : "The clients decide what you see. Changes take effect immediately."} />
      {!isActive(s, me) ? (
        <NotYet />
      ) : (
        <>
          {client && pending.length > 0 && (
            <Section title="For you to approve" count={pending.length}>
              <div className="grid gap-4 @3xl:grid-cols-2">
                {pending.map((c) => (
                  <ConsentCard key={c.id} c={c} />
                ))}
              </div>
            </Section>
          )}
          {waiting.length > 0 && (
            <Section title="Waiting on the clients" count={waiting.length}>
              <ul className="panel divide-y">
                {waiting.map((c) => (
                  <li key={c.id} className="space-y-1 p-4">
                    <p className="font-medium">{c.title}</p>
                    <RuleLine text={RULE[c.rule].line} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title={client ? "Your team" : "The team"}>
            <ul className="panel divide-y" data-tour="invite-team">
              {(client ? PROS : PROS.filter((p) => p === me || isActive(s, p))).map((p) => (
                <TeamRow key={p} p={p} />
              ))}
            </ul>
          </Section>
          {past.length > 0 && (
            <Section title="Decisions">
              <ul className="panel divide-y">
                {past.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 p-4">
                    <ShieldCheck className="size-4 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.92rem] font-medium">{c.title}</p>
                      <p className="text-[0.78rem] text-muted-foreground">
                        {RULE[c.rule].short} · {c.status === "approved" ? "Approved" : "Declined"} · {timeAgo(c.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
