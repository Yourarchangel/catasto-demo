// Catasto V1.1 data model. Three features: File Sharing, Secure Message, Consent Management.
// Everything the product shows is derived from one HouseholdState object.

export type Role = "planner" | "cpa" | "attorney" | "client";
export type PersonId = "elena" | "gary" | "rebecca" | "priya" | "daniel";
export type ProId = "elena" | "gary" | "rebecca";
export type ClientId = "priya" | "daniel";
export type FolderId = "tax" | "estate" | "insurance" | "investments";
export type View = "home" | "files" | "messages" | "consent" | "activity";

export interface Person {
  id: PersonId;
  name: string;
  first: string;
  role: Role;
  title: string;
  firm?: string;
  email: string;
  initials: string;
}

// A professional's place in the household. Only the clients can change it.
export interface Member {
  status: "none" | "pending" | "approved" | "revoked";
  folders: FolderId[];
  since?: string;
}

// The consent rule behind a hold or a block, shown in one short line.
export type Rule = "regsp" | "7216" | "rule16";

export interface FileItem {
  id: string;
  name: string;
  folder: FolderId;
  uploadedBy: PersonId;
  at: string;
  size: string;
  preview?: string[]; // seeded files: a few lines shown in the viewer
  blobKey?: string; // real uploads, kept in IndexedDB
  mime?: string;
  sharedWith: PersonId[]; // shares on top of folder access, each approved by the clients
  hold?: { rule: Rule; consentId: string; from: PersonId[] }; // held from these people until the clients approve
}

export interface Consent {
  id: string;
  kind: "planner" | "member" | "7216" | "privilege";
  rule: Rule;
  title: string;
  detail: string;
  person?: ProId; // who gets access
  folders?: FolderId[];
  fileId?: string;
  shareWith?: PersonId[];
  requestedBy: PersonId;
  at: string;
  needsBoth: boolean;
  signatures: Partial<Record<ClientId, string>>;
  status: "pending" | "approved" | "declined";
}

export interface Conversation {
  id: string;
  members: PersonId[];
  title?: string;
}

export interface Message {
  id: string;
  convId: string;
  by: PersonId;
  at: string;
  text: string;
  fileId?: string;
  simulated?: boolean;
}

export type ActivityKind = "signin" | "household" | "upload" | "view" | "download" | "share" | "approve" | "revoke" | "message" | "hold";

export interface Activity {
  id: string;
  at: string;
  actor: PersonId;
  kind: ActivityKind;
  text: string;
  fileId?: string;
  simulated?: boolean;
}

export interface Notice {
  id: string;
  to: PersonId;
  at: string;
  read: boolean;
  view: View;
}

export interface HouseholdState {
  version: number;
  household: { status: "none" | "active"; name: string; city: string; createdAt?: string };
  members: Record<ProId, Member>;
  files: FileItem[];
  consents: Consent[];
  conversations: Conversation[];
  messages: Message[];
  lastRead: Record<string, Partial<Record<PersonId, string>>>;
  activity: Activity[];
  notices: Notice[];
  signedIn: PersonId[];
  n: number;
}
