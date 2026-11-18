"use client";
import { Download, Eye, FileUp, KeyRound, Home, MessageSquare, Share2, ShieldCheck, ShieldOff, Lock } from "lucide-react";
import type { Activity, ActivityKind, HouseholdState, PersonId } from "@/lib/demo/types";
import { useHousehold } from "@/lib/demo/store";
import { PEOPLE } from "@/lib/demo/seed";
import { canSeeFile, isClient } from "@/lib/demo/rules";
import { Empty, IconTile, PageHeader } from "../bits";
import { useUi } from "../ui-state";

const ICON: Record<ActivityKind, React.ElementType> = { signin: KeyRound, household: Home, upload: FileUp, view: Eye, download: Download, share: Share2, approve: ShieldCheck, revoke: ShieldOff, message: MessageSquare, hold: Lock };

function visible(s: HouseholdState, me: PersonId, a: Activity) {
  if (a.fileId) {
    const f = s.files.find((x) => x.id === a.fileId);
    if (f && !canSeeFile(s, me, f) && !isClient(me)) return a.actor === me;
  }
  if (isClient(me) || me === "elena") return true;
  return a.actor === me || a.text.includes(PEOPLE[me].name) || (!!a.fileId && a.kind !== "view");
}

export function ActivityView() {
  const s = useHousehold();
  const { me } = useUi();
  const list = s.activity.filter((a) => visible(s, me, a));
  const days = [...new Set(list.map((a) => new Date(a.at).toDateString()))];
  return (
    <div>
      <PageHeader eyebrow="Activity log" title="Activity" lead="Who uploaded, viewed, shared, approved or removed what, and when. Nothing here can be edited." />
      {list.length === 0 ? (
        <Empty icon={ShieldCheck} title="Nothing yet" />
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d}>
              <h2 className="mb-2 text-[0.8rem] font-medium text-muted-foreground">{new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h2>
              <ul className="panel divide-y">
                {list
                  .filter((a) => new Date(a.at).toDateString() === d)
                  .map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3 @xl:items-center">
                      <IconTile icon={ICON[a.kind]} tone={a.kind === "approve" || a.kind === "revoke" ? "blue" : "light"} />
                      <div className="min-w-0 flex-1 @xl:flex @xl:items-center @xl:gap-3">
                      <p className="min-w-0 flex-1 text-[0.9rem] leading-snug">
                        <span className="font-medium">{a.actor === me ? "You" : PEOPLE[a.actor].name}</span> {a.text}
                        {a.simulated && <span className="ml-1.5 rounded border border-dashed px-1 text-[0.7rem] text-muted-foreground">simulated</span>}
                      </p>
                      <time className="mt-0.5 block shrink-0 text-[0.75rem] tabular text-muted-foreground @xl:mt-0">{new Date(a.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
