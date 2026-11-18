"use client";
// One household, kept in the browser. Every action checks the consent rules, writes the
// activity log and sends notifications that never contain client details.
import { useSyncExternalStore } from "react";
import type { Activity, ActivityKind, ClientId, Consent, FileItem, FolderId, HouseholdState, PersonId, ProId, View } from "./types";
import { ALL_FOLDERS, LIBRARY, PEOPLE, STATE_VERSION, seedWorking, seedZero } from "./seed";
import { canSeeFile, convVisible, isActive, isClient } from "./rules";

const KEY = "catasto-v11-household";
let state: HouseholdState = load();
const listeners = new Set<() => void>();

function load(): HouseholdState {
  if (typeof window === "undefined") return seedZero();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as HouseholdState;
      if (s.version === STATE_VERSION) return s;
    }
  } catch {
    /* ignore */
  }
  return seedZero();
}

function commit(next: HouseholdState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function useHousehold() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

// ---------- outbox: what a notification said, for the demo bar ----------
type OutboxFn = (to: PersonId[]) => void;
const outbox = new Set<OutboxFn>();
export function onOutbox(fn: OutboxFn) {
  outbox.add(fn);
  return () => {
    outbox.delete(fn);
  };
}

// ---------- helpers ----------
const now = () => new Date().toISOString();
function edit(fn: (s: HouseholdState) => void) {
  const s = structuredClone(state);
  fn(s);
  commit(s);
}
function id(s: HouseholdState, p: string) {
  s.n += 1;
  return `${p}-${s.n}`;
}
function log(s: HouseholdState, actor: PersonId, kind: ActivityKind, text: string, extra: Partial<Activity> = {}) {
  s.activity.unshift({ id: id(s, "a"), at: now(), actor, kind, text, ...extra });
}
function notify(s: HouseholdState, to: PersonId[], view: View) {
  const list = [...new Set(to)];
  for (const p of list) s.notices.unshift({ id: id(s, "n"), to: p, at: now(), read: false, view });
  if (list.length) setTimeout(() => outbox.forEach((fn) => fn(list)), 0);
}
const folderLabel = (f: FolderId) => f[0].toUpperCase() + f.slice(1);
const folderList = (fs: FolderId[]) => (fs.length === 4 ? "all folders" : fs.map(folderLabel).join(" and ") + (fs.length === 1 ? " folder" : " folders"));

// ---------- sign-in ----------
export function signIn(p: PersonId) {
  edit((s) => {
    if (!s.signedIn.includes(p)) s.signedIn.push(p);
    log(s, p, "signin", "signed in with a magic link and a one-time code");
  });
}

// ---------- step 1: the planner adds a household ----------
export function addHousehold() {
  if (state.household.status === "active") return;
  edit((s) => {
    s.household.status = "active";
    s.household.createdAt = now();
    s.members.elena = { status: "pending", folders: [] };
    s.consents.push({
      id: id(s, "c"),
      kind: "planner",
      rule: "regsp",
      title: "Approve Elena Brooks, CFP, as your planner",
      detail: "Elena can see the folders you choose. Nothing else.",
      person: "elena",
      folders: [...ALL_FOLDERS],
      requestedBy: "elena",
      at: now(),
      needsBoth: false,
      signatures: {},
      status: "pending",
    });
    log(s, "elena", "household", "added the Harper household and invited Daniel and Priya");
    notify(s, ["priya", "daniel"], "home");
  });
}

// ---------- consent ----------
function apply(s: HouseholdState, c: Consent, by: ClientId) {
  c.status = "approved";
  if ((c.kind === "planner" || c.kind === "member") && c.person) {
    s.members[c.person] = { status: "approved", folders: c.folders ?? [], since: now() };
    log(s, by, "approve", `approved ${PEOPLE[c.person].name} for ${folderList(c.folders ?? [])}${c.kind === "planner" ? " (Reg S-P)" : ""}`);
    notify(s, [c.person], "home");
  }
  if (c.kind === "7216" || c.kind === "privilege") {
    const f = s.files.find((x) => x.id === c.fileId);
    if (f) {
      f.hold = undefined;
      f.sharedWith = [...new Set([...f.sharedWith, ...(c.shareWith ?? [])])];
      log(s, by, "share", `${c.kind === "7216" ? "signed the 7216 form" : "approved sharing"}. ${f.name} is shared with ${(c.shareWith ?? []).map((p) => PEOPLE[p].first).join(" and ")}`, { fileId: f.id });
      notify(s, [...(c.shareWith ?? []), c.requestedBy], "files");
    }
  }
}

export function signConsent(cid: string, by: ClientId, simulated = false) {
  edit((s) => {
    const c = s.consents.find((x) => x.id === cid);
    if (!c || c.status !== "pending" || c.signatures[by]) return;
    c.signatures[by] = now();
    const done = c.needsBoth ? c.signatures.priya && c.signatures.daniel : true;
    if (done) apply(s, c, by);
    else {
      log(s, by, "approve", `signed the 7216 form. Waiting for ${by === "priya" ? "Daniel" : "Priya"} to sign`, { fileId: c.fileId, simulated });
      notify(s, [by === "priya" ? "daniel" : "priya"], "consent");
    }
    if (simulated && s.activity[0]) s.activity[0].simulated = true;
  });
}

export function declineConsent(cid: string, by: ClientId) {
  edit((s) => {
    const c = s.consents.find((x) => x.id === cid);
    if (!c || c.status !== "pending") return;
    c.status = "declined";
    if (c.person && c.kind !== "7216") s.members[c.person] = { status: "none", folders: [] };
    log(s, by, "revoke", `declined: ${c.title.toLowerCase()}`);
    notify(s, [c.requestedBy], "home");
  });
}

// ---------- step 3: the client invites a professional and picks folders ----------
export function inviteMember(by: ClientId, person: ProId, folders: FolderId[]) {
  edit((s) => {
    s.consents.push({
      id: id(s, "c"),
      kind: "member",
      rule: "regsp",
      title: `Add ${PEOPLE[person].name} to your team`,
      detail: folderList(folders),
      person,
      folders,
      requestedBy: by,
      at: now(),
      needsBoth: false,
      signatures: { [by]: now() },
      status: "approved",
    });
    s.members[person] = { status: "approved", folders, since: now() };
    log(s, by, "approve", `invited ${PEOPLE[person].name} to ${folderList(folders)}`);
    notify(s, [person], "home");
  });
}

export function setFolders(by: ClientId, person: ProId, folders: FolderId[]) {
  edit((s) => {
    s.members[person].folders = folders;
    log(s, by, folders.length ? "approve" : "revoke", `changed ${PEOPLE[person].first}'s access to ${folders.length ? folderList(folders) : "no folders"}`);
  });
}

export function revokeMember(by: ClientId, person: ProId) {
  edit((s) => {
    s.members[person] = { status: "revoked", folders: [] };
    log(s, by, "revoke", `removed ${PEOPLE[person].name}. Access ended immediately`);
  });
}

// ---------- file sharing ----------
export function uploadFile(by: PersonId, input: { name: string; folder: FolderId; size: string; blobKey?: string; mime?: string; preview?: string[] }, simulated = false) {
  let fid = "";
  edit((s) => {
    fid = id(s, "f");
    const f: FileItem = { id: fid, name: input.name, folder: input.folder, uploadedBy: by, at: now(), size: input.size, blobKey: input.blobKey, mime: input.mime, preview: input.preview, sharedWith: [] };
    s.files.unshift(f);
    // IRC 7216: return information from the CPA is held from other professionals until both clients sign.
    if (by === "gary" && input.folder === "tax") {
      const others: PersonId[] = (["elena", "rebecca"] as ProId[]).filter((p) => s.members[p].status === "approved" && s.members[p].folders.includes("tax"));
      if (others.length) {
        const cid = id(s, "c");
        f.hold = { rule: "7216", consentId: cid, from: others };
        s.consents.push({
          id: cid,
          kind: "7216",
          rule: "7216",
          title: `Let Gary share ${input.name.replace(/\.pdf$/i, "")} with ${others.map((p) => PEOPLE[p].first).join(" and ")}`,
          detail: "A CPA needs your signed consent before your return goes to anyone else. Both of you sign on a joint return.",
          fileId: fid,
          shareWith: others,
          requestedBy: "gary",
          at: now(),
          needsBoth: true,
          signatures: {},
          status: "pending",
        });
        notify(s, ["priya", "daniel"], "consent");
      }
    }
    log(s, by, "upload", `uploaded ${input.name}${by === "rebecca" ? " (private to the attorney)" : f.hold ? " (held for 7216 consent)" : ""}`, { fileId: fid, simulated });
    const see = (["elena", "gary", "rebecca", "priya", "daniel"] as PersonId[]).filter((p) => p !== by && canSeeFile(s, p, f));
    notify(s, see, "files");
  });
  return fid;
}

// ABA Rule 1.6: an attorney document is shared only after a privilege warning and client approval.
export function requestAttorneyShare(fileId: string, withWho: PersonId[]) {
  edit((s) => {
    const f = s.files.find((x) => x.id === fileId);
    if (!f) return;
    s.consents.push({
      id: id(s, "c"),
      kind: "privilege",
      rule: "rule16",
      title: `Let Rebecca share ${f.name.replace(/\.pdf$/i, "")} with ${withWho.map((p) => PEOPLE[p].first).join(" and ")}`,
      detail: "Sharing an attorney's document can waive attorney-client privilege. One of you approves.",
      fileId,
      shareWith: withWho,
      requestedBy: "rebecca",
      at: now(),
      needsBoth: false,
      signatures: {},
      status: "pending",
    });
    log(s, "rebecca", "share", `asked the clients to approve sharing ${f.name} (ABA Rule 1.6)`, { fileId });
    notify(s, ["priya", "daniel"], "consent");
  });
}

export function logFile(by: PersonId, fileId: string, kind: "view" | "download") {
  edit((s) => {
    const f = s.files.find((x) => x.id === fileId);
    if (f) log(s, by, kind, `${kind === "view" ? "viewed" : "downloaded"} ${f.name}`, { fileId });
  });
}

// ---------- secure message ----------
export function openDirect(a: PersonId, b: PersonId) {
  const cid = `dm-${[a, b].sort().join("-")}`;
  if (!state.conversations.some((c) => c.id === cid)) edit((s) => s.conversations.push({ id: cid, members: [a, b] }));
  return cid;
}

export function sendMessage(convId: string, by: PersonId, text: string, fileId?: string, simulated = false) {
  edit((s) => {
    const c = s.conversations.find((x) => x.id === convId);
    if (!c || !isActive(s, by)) return;
    s.messages.push({ id: id(s, "m"), convId, by, at: now(), text, fileId, simulated });
    s.lastRead[convId] = { ...(s.lastRead[convId] ?? {}), [by]: now() };
    log(s, by, "message", `sent a message${c.title ? ` in ${c.title}` : ""}${fileId ? " with a file" : ""}`, { simulated });
    notify(s, c.members.filter((m) => m !== by && convVisible(s, m, c.members)), "messages");
  });
}

export function markRead(convId: string, p: PersonId) {
  const last = state.messages.filter((m) => m.convId === convId).at(-1);
  if (!last || (state.lastRead[convId]?.[p] ?? "") >= last.at) return;
  edit((s) => {
    s.lastRead[convId] = { ...(s.lastRead[convId] ?? {}), [p]: now() };
  });
}

export function unread(s: HouseholdState, p: PersonId, convId?: string) {
  return s.conversations
    .filter((c) => (!convId || c.id === convId) && convVisible(s, p, c.members))
    .reduce((n, c) => n + s.messages.filter((m) => m.convId === c.id && m.by !== p && m.at > (s.lastRead[c.id]?.[p] ?? "")).length, 0);
}

// ---------- notifications ----------
export function readNotices(p: PersonId) {
  if (!state.notices.some((n) => n.to === p && !n.read)) return;
  edit((s) => s.notices.forEach((n) => n.to === p && (n.read = true)));
}

// ---------- demo ----------
export function resetDemo(kind: "zero" | "working") {
  commit(kind === "zero" ? seedZero() : seedWorking());
}

export function addLibraryFile(key: keyof typeof LIBRARY, simulated = true) {
  const l = LIBRARY[key];
  return uploadFile(l.uploadedBy, { name: l.name, folder: l.folder, size: l.size, preview: l.preview }, simulated);
}

export const pendingFor = (s: HouseholdState, p: PersonId) =>
  isClient(p) ? s.consents.filter((c) => c.status === "pending" && !c.signatures[p as ClientId]) : [];
