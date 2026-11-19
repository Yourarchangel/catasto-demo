"use client";
import { useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import type { Household, Role } from "@/lib/core/types";
import { ROLE_LABEL } from "@/lib/core/types";
import { invite, inviteLink } from "@/lib/core/api";
import { PEOPLE } from "@/lib/core/seed";
import { Btn, Field, Modal, Pill, when } from "./ui";

const INVITEES: Role[] = ["client", "cpa", "attorney"];

// The adviser's team page: invite the client, the CPA and the attorney.
export function TeamTab({ h, me }: { h: Household; me: Role }) {
  const [inviting, setInviting] = useState<Role>();
  return (
    <div className="space-y-3">
      {INVITEES.map((r) => {
        const m = h.members[r];
        return (
          <div key={r} className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {ROLE_LABEL[r]} <Pill solid={m.status === "joined"}>{m.status === "joined" ? "Joined" : m.status === "invited" ? "Invited" : "Not invited"}</Pill>
              </p>
              {m.status === "joined" && <p className="mt-0.5 text-[0.78rem] text-muted-foreground">Joined {when(m.joinedAt!)}. Sees only what the client approves.</p>}
              {m.status === "invited" && <LinkLine token={m.invite!.token} expires={m.invite!.expiresAt} />}
              {m.status === "none" && <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{r === "client" ? "Invite the client first. Nobody sees anything until they consent." : "They join free and see only what the client approves."}</p>}
            </div>
            {m.status === "none" && me === "adviser" && (
              <Btn size="sm" onClick={() => (r === "client" ? invite(h.id, me, "client") : setInviting(r))}>
                <UserPlus className="size-3.5" aria-hidden /> Invite {ROLE_LABEL[r]}
              </Btn>
            )}
          </div>
        );
      })}
      {inviting && <InviteDialog h={h} me={me} role={inviting} onClose={() => setInviting(undefined)} />}
    </div>
  );
}

function LinkLine({ token, expires }: { token: string; expires: string }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(token);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="rounded border bg-muted px-2 py-1 font-mono text-[0.72rem]">{link}</code>
      <Btn
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard?.writeText(link).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy link"}
      </Btn>
      <span className="text-[0.72rem] text-muted-foreground">One use. Expires {new Date(expires).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</span>
    </div>
  );
}

function InviteDialog({ h, me, role, onClose }: { h: Household; me: Role; role: Role; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <Modal open onClose={onClose} title={`Invite the ${ROLE_LABEL[role]}`} desc="You'll get a one-use link to send them. It expires in 7 days.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          invite(h.id, me, role, { name, email });
          onClose();
        }}
      >
        <Field label="Name" value={name} onChange={setName} sample={PEOPLE[role].name} autoFocus />
        <Field label="Email" value={email} onChange={setEmail} sample={PEOPLE[role].email} />
        <Btn className="w-full" disabled={!email}>
          Create invite link
        </Btn>
      </form>
    </Modal>
  );
}
