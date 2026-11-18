// Consent rules, written as code. Every screen asks these functions what a person may see.
import type { FileItem, HouseholdState, PersonId, ProId, Rule } from "./types";
import { PEOPLE, PROS } from "./seed";

export const isClient = (p: PersonId) => p === "priya" || p === "daniel";
export const isPro = (p: PersonId): p is ProId => !isClient(p);

export const RULE: Record<Rule, { short: string; line: string }> = {
  regsp: { short: "Reg S-P", line: "Reg S-P: the clients approve each professional before they see anything." },
  "7216": { short: "IRC 7216", line: "IRC 7216: held until both clients sign the consent form." },
  rule16: { short: "ABA Rule 1.6", line: "ABA Rule 1.6: private to the attorney until the clients approve sharing." },
};

export function isActive(s: HouseholdState, p: PersonId) {
  if (s.household.status !== "active") return false;
  if (isClient(p)) return true;
  return s.members[p as ProId].status === "approved";
}

export function canSeeFile(s: HouseholdState, p: PersonId, f: FileItem) {
  if (!isActive(s, p)) return false;
  if (isClient(p)) return true;
  if (f.uploadedBy === p) return true;
  if (f.hold && f.hold.from.includes(p)) return false;
  if (f.uploadedBy === "rebecca") return f.sharedWith.includes(p);
  if (f.sharedWith.includes(p)) return true;
  return s.members[p as ProId].folders.includes(f.folder);
}

// Why someone cannot open a file, in one short line.
export function blockedLine(s: HouseholdState, p: PersonId, f: FileItem) {
  if (!isActive(s, p)) return RULE.regsp.line;
  if (f.hold && f.hold.from.includes(p)) return RULE[f.hold.rule].line;
  if (f.uploadedBy === "rebecca") return RULE.rule16.line;
  return "Not shared with you. The clients decide who sees each folder.";
}

export function whoCanSee(s: HouseholdState, f: FileItem): PersonId[] {
  return (["priya", "daniel", ...PROS] as PersonId[]).filter((p) => canSeeFile(s, p, f));
}

export function visibleFiles(s: HouseholdState, p: PersonId) {
  return s.files.filter((f) => canSeeFile(s, p, f));
}

// Files this person can see exist but cannot open: shown locked, with the rule.
export function heldFiles(s: HouseholdState, p: PersonId) {
  if (!isActive(s, p) || isClient(p)) return [];
  return s.files.filter((f) => !canSeeFile(s, p, f) && f.hold && f.hold.from.includes(p));
}

export function canMessage(s: HouseholdState, p: PersonId) {
  return isActive(s, p);
}

export function convVisible(s: HouseholdState, p: PersonId, members: PersonId[]) {
  if (!isActive(s, p) || !members.includes(p)) return false;
  return members.length > 2 || members.every((m) => isActive(s, m));
}

export function nameOf(p: PersonId) {
  const x = PEOPLE[p];
  return isClient(p) ? x.name : `${x.name}, ${x.title}`;
}
