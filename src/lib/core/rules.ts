// The consent engine. Every screen asks these functions what a role may see or do.
// The backend must enforce the same rules on the server (see the C4, rules R1 to R7).
import type { Folder, Household, Role } from "./types";

export const isJoined = (h: Household, r: Role) => h.members[r].status === "joined";

// R1 + R6: the client must have joined and signed the general consent before
// any professional sees anything outside their own workspace.
export const consentSigned = (h: Household) => !!h.consent;

// can(role, "view", folder)
export function canView(h: Household, r: Role, f: Folder): boolean {
  if (!isJoined(h, r)) return false;
  if (r === "client") return true; // the client sees everything in their household
  if (f.owner === r) return true; // your own workspace
  if (!consentSigned(h)) return false;
  if (!isJoined(h, f.owner)) return false;
  if (h.consent!.sweeping) return true; // general consent between professionals
  return f.grants.includes(r); // R2: only what the client approved
}

// Only the owner adds files to a folder. Nobody writes into someone else's workspace.
export const canUpload = (h: Household, r: Role, f: Folder) => isJoined(h, r) && f.owner === r;

// R6: only the client approves, declines or changes access.
export const canManageAccess = (r: Role) => r === "client";

// Only the adviser invites people in the MVP.
export const canInvite = (r: Role) => r === "adviser";

export const pendingRequests = (h: Household) => h.requests.filter((q) => q.status === "pending");

export function pendingFor(h: Household, folderId: string, r: Role) {
  return h.requests.some((q) => q.folderId === folderId && q.forRole === r && q.status === "pending");
}

// R5 + R7: blocked folders are shown locked, never hidden, and return no files.
export function visibleFiles(h: Household, r: Role, f: Folder) {
  return canView(h, r, f) ? h.files.filter((x) => x.folderId === f.id) : [];
}

export const threadsFor = (h: Household, r: Role) =>
  isJoined(h, r) ? h.threads.filter((t) => t.members.includes(r)) : [];
