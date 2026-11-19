"use client";
// The demo's API. Every screen calls these functions and nothing else.
// For the real build, keep the same function names and replace each body with a
// server call. The server must check the same rules (see rules.ts) before acting.
import { useSyncExternalStore } from "react";
import type { DemoState, FileItem, Household, Role } from "./types";
import { PROS } from "./types";
import { part1, part2, defaultFolders, emptyMembers } from "./seed";
import { sampleById } from "./samples";
import { canUpload, canView, canManageAccess, canInvite } from "./rules";

let state: DemoState = part1();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export const useDemo = () => useSyncExternalStore(subscribe, () => state, () => state);
export const getState = () => state;

const now = () => new Date().toISOString();
const id = (p: string) => `${p}${++state.n}`;

function update(fn: (s: DemoState) => void) {
  const next: DemoState = structuredClone({ ...state, households: state.households.map((h) => ({ ...h })) });
  // blob URLs survive structuredClone as strings, so real uploads keep working
  fn(next);
  state = next;
  emit();
}

function withHousehold(hid: string, fn: (h: Household, s: DemoState) => void) {
  update((s) => {
    const h = s.households.find((x) => x.id === hid);
    if (h) fn(h, s);
  });
}

const log = (h: Household, actor: Role, action: string, target?: string, result: "allowed" | "denied" = "allowed") =>
  h.audit.push({ at: now(), actor, action, target, result });

// ---------- demo controls ----------
export const startPart = (p: 1 | 2) => {
  state = p === 1 ? part1() : part2();
  emit();
};
export const setView = (r: Role) => update((s) => void (s.view = r));
export const openHousehold = (hid?: string) => update((s) => void (s.openHouseholdId = hid));

// ---------- identity (sign-in + MFA) ----------
export const adviserPassword = () => update((s) => void (s.adviserAuth = "mfa"));
export const adviserVerified = () => update((s) => void (s.adviserAuth = "in"));

// ---------- households ----------
export function createHousehold(input: { name: string; clientName: string; email: string; phone: string }) {
  let newId = "";
  update((s) => {
    newId = id("h-");
    const h: Household = {
      id: newId,
      name: input.name,
      createdAt: now(),
      members: emptyMembers(),
      folders: defaultFolders(newId),
      files: [],
      requests: [],
      threads: [],
      messages: [],
      audit: [],
    };
    h.members.client = { status: "none", name: input.clientName, email: input.email, phone: input.phone };
    log(h, "adviser", "created household", input.name);
    s.households.unshift(h);
  });
  return newId;
}

// ---------- invites ----------
export function invite(hid: string, by: Role, role: Role, person?: { name?: string; email?: string }) {
  if (!canInvite(by)) return;
  withHousehold(hid, (h) => {
    const token = Math.random().toString(36).slice(2, 10);
    const created = new Date();
    const expires = new Date(created.getTime() + 7 * 864e5);
    h.members[role] = { ...h.members[role], ...person, status: "invited", invite: { token, createdAt: created.toISOString(), expiresAt: expires.toISOString() } };
    log(h, by, "created invite", role);
  });
}

export const inviteLink = (token: string) => `https://app.getcatasto.com/join/${token}`;

export function join(hid: string, role: Role, person: { name: string; email: string; phone: string }) {
  withHousehold(hid, (h) => {
    const m = h.members[role];
    if (m.status !== "invited" || !m.invite || m.invite.usedAt) return log(h, role, "join", "invite already used", "denied");
    h.members[role] = { ...m, ...person, status: "joined", joinedAt: now(), invite: { ...m.invite, usedAt: now() } };
    // everyone who has joined shares one team thread
    const team = h.threads.find((t) => t.title === "Whole team");
    const joined = (Object.keys(h.members) as Role[]).filter((r) => h.members[r].status === "joined");
    if (team) team.members = joined;
    else if (joined.length > 1) h.threads.unshift({ id: id("t"), members: joined, title: "Whole team" });
    log(h, role, "joined household");
  });
}

// ---------- consent ----------
export function signConsent(hid: string, typedName: string, sweeping: boolean) {
  withHousehold(hid, (h) => {
    h.consent = { typedName, signedAt: now(), sweeping };
    log(h, "client", "signed general consent", sweeping ? "sweeping" : "ask each time");
  });
}

export function setSweeping(hid: string, by: Role, sweeping: boolean) {
  if (!canManageAccess(by)) return;
  withHousehold(hid, (h) => {
    if (!h.consent) return;
    h.consent.sweeping = sweeping;
    if (sweeping) h.requests.forEach((q) => q.status === "pending" && (q.status = "approved"));
    log(h, by, "changed sweeping consent", String(sweeping));
  });
}

export function setGrant(hid: string, by: Role, folderId: string, role: Role, on: boolean) {
  if (!canManageAccess(by)) return;
  withHousehold(hid, (h) => {
    const f = h.folders.find((x) => x.id === folderId);
    if (!f || f.owner === role || role === "client") return;
    f.grants = on ? [...new Set([...f.grants, role])] : f.grants.filter((r) => r !== role);
    h.requests.forEach((q) => q.folderId === folderId && q.forRole === role && q.status === "pending" && (q.status = on ? "approved" : "declined"));
    log(h, by, on ? "granted access" : "removed access", `${f.name} to ${role}`);
  });
}

export function requestAccess(hid: string, by: Role, folderId: string, forRole: Role) {
  withHousehold(hid, (h) => {
    if (h.requests.some((q) => q.folderId === folderId && q.forRole === forRole && q.status === "pending")) return;
    h.requests.push({ id: id("q"), folderId, forRole, requestedBy: by, at: now(), status: "pending" });
    log(h, by, "requested access", `${folderId} for ${forRole}`);
  });
}

export function decide(hid: string, by: Role, requestId: string, approve: boolean) {
  if (!canManageAccess(by)) return;
  withHousehold(hid, (h) => {
    const q = h.requests.find((x) => x.id === requestId);
    if (!q || q.status !== "pending") return;
    q.status = approve ? "approved" : "declined";
    const f = h.folders.find((x) => x.id === q.folderId);
    if (approve && f && !f.grants.includes(q.forRole)) f.grants.push(q.forRole);
    log(h, by, approve ? "approved request" : "declined request", `${f?.name} for ${q.forRole}`);
  });
}

// ---------- folders and files ----------
export function createFolder(hid: string, by: Role, name: string, shareWith: Role[]) {
  withHousehold(hid, (h) => {
    const f = { id: id("f"), owner: by, name, grants: [] as Role[] };
    h.folders.push(f);
    log(h, by, "created folder", name);
    for (const r of shareWith) {
      if (r === by || r === "client") continue;
      if (by === "client") f.grants.push(r); // the client decides directly
      else if (!h.consent?.sweeping) h.requests.push({ id: id("q"), folderId: f.id, forRole: r, requestedBy: by, at: now(), status: "pending" });
    }
  });
}

export function upload(hid: string, by: Role, folderId: string, file: { sampleId: string } | { name: string; size: number; url: string; mime: string }) {
  withHousehold(hid, (h) => {
    const f = h.folders.find((x) => x.id === folderId);
    if (!f || !canUpload(h, by, f)) return log(h, by, "upload", folderId, "denied");
    let item: FileItem;
    if ("sampleId" in file) {
      const s = sampleById(file.sampleId)!;
      item = { id: id("x"), folderId, name: s.name, size: s.size, uploadedBy: by, at: now(), sampleId: s.id };
    } else {
      const kb = file.size / 1024;
      item = { id: id("x"), folderId, name: file.name, size: kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`, uploadedBy: by, at: now(), url: file.url, mime: file.mime };
    }
    h.files.push(item);
    log(h, by, "uploaded", item.name);
  });
}

// Viewing a file: check consent, then log (Figure 4 in the C4).
export function viewFile(hid: string, by: Role, fileId: string) {
  const h = state.households.find((x) => x.id === hid);
  const file = h?.files.find((x) => x.id === fileId);
  const folder = h?.folders.find((x) => x.id === file?.folderId);
  if (!h || !file || !folder) return false;
  const ok = canView(h, by, folder);
  h.audit.push({ at: now(), actor: by, action: "viewed file", target: file.name, result: ok ? "allowed" : "denied" });
  return ok;
}

// ---------- messages ----------
export function openThread(hid: string, by: Role, members: Role[]) {
  let tid = "";
  withHousehold(hid, (h) => {
    const set = [...new Set([by, ...members])].sort();
    const found = h.threads.find((t) => [...t.members].sort().join() === set.join());
    if (found) tid = found.id;
    else {
      tid = id("t");
      h.threads.unshift({ id: tid, members: set as Role[] });
      log(h, by, "started thread", set.join(", "));
    }
  });
  return tid;
}

export function send(hid: string, by: Role, threadId: string, text: string) {
  withHousehold(hid, (h) => {
    const t = h.threads.find((x) => x.id === threadId);
    if (!t || !t.members.includes(by)) return;
    h.messages.push({ id: id("m"), threadId, by, text, at: now() });
    log(h, by, "sent message", threadId);
  });
}

export const professionals = PROS;
