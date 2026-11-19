// Catasto MVP data model. Mirrors the tables in the MVP Architecture C4 (Draft 2).
// Everything here is in-memory demo state. The backend replaces it table for table.

export type Role = "adviser" | "client" | "cpa" | "attorney";
export const ROLES: Role[] = ["adviser", "client", "cpa", "attorney"];
export const PROS: Role[] = ["adviser", "cpa", "attorney"];

export const ROLE_LABEL: Record<Role, string> = {
  adviser: "Adviser",
  client: "Client",
  cpa: "CPA",
  attorney: "Attorney",
};

// memberships: a person's place in a household
export interface Member {
  status: "none" | "invited" | "joined";
  name?: string;
  email?: string;
  phone?: string;
  invite?: Invite;
  joinedAt?: string;
  // Demo only: a different person in this role than the one you "view as".
  // (The Okafor and Brennan clients are not Priya Harper.)
  someoneElse?: boolean;
}

// invites: a one-use, 7-day join link
export interface Invite {
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

// consents: the client's general information-sharing consent
export interface GeneralConsent {
  typedName: string;
  signedAt: string;
  // true = professionals may see each other's folders without asking each time
  sweeping: boolean;
}

// A folder lives in one role's workspace. Only the owner adds files.
// The client always sees everything. Anyone else needs a grant (or sweeping consent).
export interface Folder {
  id: string;
  owner: Role;
  name: string;
  grants: Role[];
}

// items: a file
export interface FileItem {
  id: string;
  folderId: string;
  name: string;
  size: string;
  uploadedBy: Role;
  at: string;
  sampleId?: string; // seeded or picked sample document
  url?: string; // a real file chosen from the computer (blob URL, memory only)
  mime?: string;
}

// An access request the client approves or declines.
export interface AccessRequest {
  id: string;
  folderId: string;
  forRole: Role; // who would get access
  requestedBy: Role;
  at: string;
  status: "pending" | "approved" | "declined";
}

// items: messages, in threads (a direct message or a group chat)
export interface Thread {
  id: string;
  members: Role[];
  title?: string;
}
export interface Message {
  id: string;
  threadId: string;
  by: Role;
  text: string;
  at: string;
}

// audit_events: append-only. No screen in the MVP.
export interface AuditEvent {
  at: string;
  actor: Role;
  action: string;
  target?: string;
  result: "allowed" | "denied";
}

export interface Household {
  id: string;
  name: string;
  createdAt: string;
  members: Record<Role, Member>;
  consent?: GeneralConsent;
  // Adviser setting. On by default: the adviser's workspace is open to the team the client approves.
  // Off locks it to the adviser and the client. The adviser can only lock, never grant.
  adviserShares: boolean;
  folders: Folder[];
  files: FileItem[];
  requests: AccessRequest[];
  threads: Thread[];
  messages: Message[];
  audit: AuditEvent[];
}

export type AdviserAuth = "signed-out" | "mfa" | "in";

export interface DemoState {
  part: 1 | 2;
  view: Role; // whose screen we are looking at (demo only)
  adviserAuth: AdviserAuth;
  adviser: { name: string; email: string; firm: string };
  adviserShares: boolean; // adviser setting, applies to every household
  households: Household[];
  open: Partial<Record<Role, string>>; // which household each view has open (demo only)
  n: number; // id counter
}
