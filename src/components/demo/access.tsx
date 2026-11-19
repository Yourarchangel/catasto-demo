"use client";
import { Check, X } from "lucide-react";
import type { Household, Role } from "@/lib/core/types";
import { ROLE_LABEL } from "@/lib/core/types";
import { decide, setGrant, setSweeping } from "@/lib/core/api";
import { isJoined, pendingRequests } from "@/lib/core/rules";
import { Btn, Empty, Panel, when } from "./ui";
import { cn } from "@/lib/utils";

const PROS: Role[] = ["adviser", "cpa", "attorney"];

function ruleNote(owner: Role) {
  if (owner === "cpa") return "Tax return information. Approving gives your IRC 7216 consent for this folder.";
  if (owner === "attorney") return "Attorney documents. Sharing them can affect legal privilege.";
  return undefined;
}

// The client's control panel: requests, the sweeping choice, and who sees what.
export function AccessTab({ h }: { h: Household }) {
  const reqs = pendingRequests(h);
  const sweeping = !!h.consent?.sweeping;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 border-b pb-2 text-[1.05rem] font-semibold">Requests {reqs.length > 0 && <span className="ml-1 rounded-full bg-foreground px-2 py-0.5 text-[0.7rem] text-background">{reqs.length}</span>}</h2>
        {reqs.length === 0 ? (
          <Empty>Nothing to approve.</Empty>
        ) : (
          <ul className="space-y-3">
            {reqs.map((q) => {
              const f = h.folders.find((x) => x.id === q.folderId)!;
              const note = ruleNote(f.owner);
              return (
                <li key={q.id}>
                  <Panel className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <b>{q.requestedBy === q.forRole ? `The ${ROLE_LABEL[q.forRole]}` : `The ${ROLE_LABEL[q.requestedBy]}`}</b>{" "}
                        {q.requestedBy === q.forRole ? "asks to see" : `wants the ${ROLE_LABEL[q.forRole]} to see`} <b>{f.name}</b> from the {ROLE_LABEL[f.owner]} workspace.
                      </p>
                      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
                        {when(q.at)}
                        {note && ` · ${note}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Btn size="sm" variant="outline" onClick={() => decide(h.id, "client", q.id, false)}>
                        <X className="size-3.5" aria-hidden /> Decline
                      </Btn>
                      <Btn size="sm" onClick={() => decide(h.id, "client", q.id, true)}>
                        <Check className="size-3.5" aria-hidden /> Approve
                      </Btn>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 border-b pb-2 text-[1.05rem] font-semibold">Sharing between professionals</h2>
        <Panel className="flex items-center gap-4 p-4">
          <div className="flex-1">
            <p className="text-sm font-medium">Let my professionals see each other&apos;s folders without asking me</p>
            <p className="text-[0.8rem] text-muted-foreground">Off means you approve each folder for each person.</p>
          </div>
          <button
            role="switch"
            aria-checked={sweeping}
            aria-label="Sweeping consent"
            onClick={() => setSweeping(h.id, "client", !sweeping)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full border border-foreground transition-colors", sweeping ? "bg-foreground" : "bg-background")}
          >
            <span className={cn("absolute top-0.5 size-4.5 rounded-full transition-all", sweeping ? "left-[22px] bg-background" : "left-0.5 bg-foreground")} />
          </button>
        </Panel>
      </section>

      <section>
        <h2 className="mb-3 border-b pb-2 text-[1.05rem] font-semibold">Who sees what</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b bg-muted text-left">
                <th className="px-4 py-2.5 font-medium">Folder</th>
                {PROS.map((r) => (
                  <th key={r} className="px-4 py-2.5 text-center font-medium">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {h.folders
                .filter((f) => isJoined(h, f.owner))
                .map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{f.name}</span>
                      <span className="block text-[0.72rem] text-muted-foreground">{ROLE_LABEL[f.owner]} workspace</span>
                    </td>
                    {PROS.map((r) => (
                      <td key={r} className="px-4 py-2.5 text-center">
                        {f.owner === r ? (
                          <span className="text-[0.75rem] text-muted-foreground">Owner</span>
                        ) : !isJoined(h, r) ? (
                          <span className="text-[0.75rem] text-muted-foreground">Not joined</span>
                        ) : (
                          <input
                            type="checkbox"
                            aria-label={`${ROLE_LABEL[r]} can see ${f.name}`}
                            className="size-4 accent-black"
                            disabled={sweeping}
                            checked={sweeping || f.grants.includes(r)}
                            onChange={(e) => setGrant(h.id, "client", f.id, r, e.target.checked)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {h.consent && <p className="mt-3 text-[0.75rem] text-muted-foreground">Information sharing consent signed by {h.consent.typedName}, {when(h.consent.signedAt)}. You always see every folder.</p>}
      </section>
    </div>
  );
}
