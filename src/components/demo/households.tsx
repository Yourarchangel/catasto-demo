"use client";
import { useState } from "react";
import { ChevronRight, Mail, Plus } from "lucide-react";
import type { Household, Role } from "@/lib/core/types";
import { ROLE_LABEL, ROLES } from "@/lib/core/types";
import { acceptInvite, createHousehold, openHousehold } from "@/lib/core/api";
import { isMine, pendingRequests } from "@/lib/core/rules";
import { PEOPLE } from "@/lib/core/seed";
import { Btn, Empty, Field, Modal, Title, fresh } from "./ui";
import { cn } from "@/lib/utils";

const statusWord = (h: Household, r: Role) => ({ none: "Not invited", invited: "Invited", joined: "Joined" })[h.members[r].status];

export function HouseholdList({ role, households }: { role: Role; households: Household[] }) {
  const [open, setOpen] = useState(false);
  const mine = role === "adviser" ? households : households.filter((h) => isMine(h, role));
  // a CPA or attorney already on Catasto can be invited to more households
  const invites = role === "cpa" || role === "attorney" ? households.filter((h) => h.members[role].status === "invited") : [];
  const sub = { adviser: "Every household you work with.", client: "Your household.", cpa: "Every household you work with as the CPA.", attorney: "Every household you work with as the Attorney." }[role];
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <Title sub={sub}>Households</Title>
        {role === "adviser" && (
          <Btn className="mb-6" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> New household
          </Btn>
        )}
      </div>
      {invites.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[0.8rem] font-medium text-muted-foreground">Invitations</h2>
          <ul className="divide-y rounded-lg border border-brand">
            {invites.map((h) => (
              <li key={h.id} className="pop flex items-center gap-4 px-5 py-4">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{h.name}</span>
                  <span className="mt-1 block text-[0.78rem] text-muted-foreground">The Adviser invited you as the {ROLE_LABEL[role]}. You&apos;ll use your existing account.</span>
                </span>
                <Btn onClick={() => acceptInvite(h.id, role)}>Accept</Btn>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mine.length === 0 ? (
        <Empty>{role === "adviser" ? "No households yet. Create your first one." : "No households yet."}</Empty>
      ) : (
        <ul className="divide-y rounded-lg border">
          {mine.map((h) => {
            const asks = pendingRequests(h).length;
            return (
              <li key={h.id} className={cn(fresh(h.createdAt) && "arrive")}>
                <button onClick={() => openHousehold(h.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{h.name}</span>
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-muted-foreground">
                      {ROLES.filter((r) => r !== "adviser").map((r) => (
                        <span key={r}>
                          {ROLE_LABEL[r]}: <span className={cn(h.members[r].status === "joined" && "text-foreground")}>{statusWord(h, r)}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  {role === "client" && asks > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-[0.7rem] font-semibold text-foreground">{asks} to approve</span>}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <NewHousehold open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewHousehold({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [v, setV] = useState({ name: "", clientName: "", email: "", phone: "" });
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const ok = v.name && v.clientName && v.email;
  return (
    <Modal open={open} onClose={onClose} title="New household" desc="Only what's needed to invite the client.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          createHousehold(v);
          setV({ name: "", clientName: "", email: "", phone: "" });
          onClose();
        }}
      >
        <Field label="Household name" value={v.name} onChange={set("name")} sample="Harper household" autoFocus />
        <Field label="Client name" value={v.clientName} onChange={set("clientName")} sample={PEOPLE.client.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client email" value={v.email} onChange={set("email")} sample={PEOPLE.client.email} />
          <Field label="Client phone" value={v.phone} onChange={set("phone")} sample={PEOPLE.client.phone} />
        </div>
        <Btn className="w-full" disabled={!ok}>
          Create household
        </Btn>
      </form>
    </Modal>
  );
}
