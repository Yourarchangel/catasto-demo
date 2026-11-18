"use client";
// Plays the other people in the demo. Every simulated step runs through the same actions and
// consent rules as a real click, and is tagged "simulated" in the activity log.
import type { ClientId, HouseholdState, PersonId } from "./types";
import { PEOPLE } from "./seed";
import { isActive } from "./rules";
import * as A from "./store";

export interface Reply {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

const REPLY: Record<PersonId, string> = {
  elena: "Thanks. I have what I need for now and will follow up this week.",
  gary: "Got it. I will look at the Roth contributions and get back to you.",
  rebecca: "Understood. I will check the trust funding and report back.",
  priya: "Thank you. Daniel and I can meet Thursday afternoon.",
  daniel: "Sounds good to me.",
};

export function availableReplies(s: HouseholdState, me: PersonId): Reply[] {
  const out: Reply[] = [];
  const other: ClientId = me === "priya" ? "daniel" : "priya";
  const signer: ClientId = me === "priya" || me === "daniel" ? other : "priya";
  const has = (name: string) => s.files.some((f) => f.name.startsWith(name));

  if (s.household.status === "none" && me !== "elena") out.push({ id: "add", label: "Elena adds the Harper household", hint: "Step 1. The clients get an invitation.", run: A.addHousehold });

  for (const c of s.consents.filter((x) => x.status === "pending")) {
    const missing = (["priya", "daniel"] as ClientId[]).filter((p) => !c.signatures[p]);
    const who = missing.includes(signer) ? signer : missing.find((p) => p !== me);
    if (!who || who === me) continue;
    const verb = c.kind === "7216" ? "signs the 7216 form" : c.kind === "privilege" ? "approves sharing the trust" : "approves Elena";
    out.push({ id: `sign-${c.id}`, label: `${PEOPLE[who].first} ${verb}`, hint: c.title, run: () => A.signConsent(c.id, who, true) });
  }

  if (isActive(s, "elena") && me !== "priya" && me !== "daniel") {
    if (s.members.gary.status !== "approved") out.push({ id: "inv-gary", label: "Priya invites Gary to the Tax folder", hint: "Step 3. The client picks what the CPA sees.", run: () => A.inviteMember("priya", "gary", ["tax"]) });
    if (s.members.rebecca.status !== "approved") out.push({ id: "inv-reb", label: "Priya invites Rebecca to the Estate folder", hint: "Step 3. The client picks what the attorney sees.", run: () => A.inviteMember("priya", "rebecca", ["estate"]) });
  }
  if (isActive(s, "gary") && me !== "gary" && !has("2025 Form 1040")) out.push({ id: "ret", label: "Gary uploads the 2025 return", hint: "Step 4. Held for 7216 consent.", run: () => A.addLibraryFile("ret2025") });
  if (isActive(s, "rebecca") && me !== "rebecca" && !has("Harper Family Trust")) out.push({ id: "trust", label: "Rebecca uploads the family trust", hint: "Private to the attorney under Rule 1.6.", run: () => A.addLibraryFile("trust") });
  const trust = s.files.find((f) => f.name.startsWith("Harper Family Trust"));
  if (trust && me !== "rebecca" && !trust.sharedWith.includes("elena") && !s.consents.some((c) => c.fileId === trust.id && c.status === "pending"))
    out.push({ id: "share-trust", label: "Rebecca asks to share the trust with Elena", hint: "Privilege warning, then client approval.", run: () => A.requestAttorneyShare(trust.id, ["elena"]) });
  if (s.household.status === "active" && me !== "priya" && !has("Term life")) out.push({ id: "ins", label: "Priya uploads her life insurance policy", hint: "A client upload goes to the folders she chose.", run: () => A.addLibraryFile("insurance") });

  // One reply in the team thread, from someone active who is not you.
  const team = s.messages.filter((m) => m.convId === "cv-team");
  const last = team.at(-1);
  const responder = (["priya", "elena", "gary", "rebecca", "daniel"] as PersonId[]).find((p) => p !== me && p !== last?.by && isActive(s, p));
  if (isActive(s, me) && responder && (!last || last.by === me)) out.push({ id: "reply", label: `${PEOPLE[responder].first} replies in Harper team`, hint: "Secure message.", run: () => A.sendMessage("cv-team", responder, REPLY[responder], undefined, true) });

  return out;
}
