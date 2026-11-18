// The fictional Harper household. Every name, number and account in this file is invented.
import type { FileItem, FolderId, HouseholdState, Person, PersonId, ProId } from "./types";

export const STATE_VERSION = 11;

export const PEOPLE: Record<PersonId, Person> = {
  elena: { id: "elena", name: "Elena Brooks", first: "Elena", role: "planner", title: "CFP", firm: "Brooks Planning Group", email: "elena@brooksplanning.example", initials: "EB" },
  gary: { id: "gary", name: "Gary Lindholm", first: "Gary", role: "cpa", title: "CPA", firm: "Lindholm & Associates", email: "gary@lindholmcpa.example", initials: "GL" },
  rebecca: { id: "rebecca", name: "Rebecca Thorne", first: "Rebecca", role: "attorney", title: "Estate attorney", firm: "Thorne Estate Law, PLLC", email: "rebecca@thorneestate.example", initials: "RT" },
  priya: { id: "priya", name: "Priya Harper", first: "Priya", role: "client", title: "Client", email: "priya@harper.example", initials: "PH" },
  daniel: { id: "daniel", name: "Daniel Harper", first: "Daniel", role: "client", title: "Client", email: "daniel@harper.example", initials: "DH" },
};

export const FOLDERS: { id: FolderId; name: string }[] = [
  { id: "tax", name: "Tax" },
  { id: "estate", name: "Estate" },
  { id: "insurance", name: "Insurance" },
  { id: "investments", name: "Investments" },
];

export const ALL_FOLDERS: FolderId[] = ["tax", "estate", "insurance", "investments"];
export const PROS: ProId[] = ["elena", "gary", "rebecca"];
export const CLIENTS = ["priya", "daniel"] as const;

// Files the simulator and the tour can add, written once here.
export const LIBRARY: Record<string, Omit<FileItem, "id" | "at" | "sharedWith" | "hold">> = {
  insurance: {
    name: "Term life policy summary.pdf",
    folder: "insurance",
    uploadedBy: "priya",
    size: "220 KB",
    preview: ["Northfield Life Insurance Company", "Policy summary, 20-year level term", "Insured: Daniel R. Harper", "Death benefit: $2,000,000", "Term ends: May 2032", "Owner and beneficiary: Priya S. Harper"],
  },
  beneficiary: {
    name: "Rollover IRA beneficiary form.pdf",
    folder: "investments",
    uploadedBy: "daniel",
    size: "140 KB",
    preview: ["Custodian beneficiary designation", "Account: Rollover IRA, ending 4417", "Owner: Daniel R. Harper", "Primary beneficiary: Eleanor M. Harper (mother), 100%", "Signed: March 14, 2003"],
  },
  ret2024: {
    name: "2024 Form 1040.pdf",
    folder: "tax",
    uploadedBy: "priya",
    size: "1.2 MB",
    preview: ["Form 1040, U.S. Individual Income Tax Return, 2024", "Filing status: Married filing jointly", "Taxpayers: Daniel R. Harper and Priya S. Harper", "Adjusted gross income: $548,200", "Total tax: $112,460"],
  },
  ret2025: {
    name: "2025 Form 1040 with schedules.pdf",
    folder: "tax",
    uploadedBy: "gary",
    size: "1.4 MB",
    preview: ["Form 1040, U.S. Individual Income Tax Return, 2025", "Filing status: Married filing jointly", "Preparer: Gary Lindholm, CPA, Lindholm & Associates", "Adjusted gross income: $565,000", "Line 4b, IRA taxable amount: 0", "Total tax: $119,790"],
  },
  trust: {
    name: "Harper Family Trust, 2016.pdf",
    folder: "estate",
    uploadedBy: "rebecca",
    size: "880 KB",
    preview: ["The Harper Family Trust, dated June 2, 2016", "Trustees: Daniel R. Harper and Priya S. Harper", "Successor trustee: Thorne Estate Law, PLLC", "Schedule A, trust property: one bank account, $5,000", "Prepared by Rebecca Thorne, Estate attorney"],
  },
};

const at = (day: number, h = 10, m = 0) => new Date(Date.UTC(2026, 9, day, h + 5, m)).toISOString();

// Start of the five-step flow: Elena has signed up, and no household exists yet.
export function seedZero(): HouseholdState {
  return {
    version: STATE_VERSION,
    household: { status: "none", name: "The Harper household", city: "Plano, Texas" },
    members: {
      elena: { status: "none", folders: [] },
      gary: { status: "none", folders: [] },
      rebecca: { status: "none", folders: [] },
    },
    files: [],
    consents: [],
    conversations: [{ id: "cv-team", members: ["elena", "gary", "rebecca", "priya", "daniel"], title: "Harper team" }],
    messages: [],
    lastRead: {},
    activity: [],
    notices: [],
    signedIn: [],
    n: 1,
  };
}

// A household already in use, for exploring every screen.
export function seedWorking(): HouseholdState {
  const s = seedZero();
  s.household = { status: "active", name: "The Harper household", city: "Plano, Texas", createdAt: at(20) };
  s.members = {
    elena: { status: "approved", folders: ["tax", "estate", "insurance", "investments"], since: at(20, 15) },
    gary: { status: "approved", folders: ["tax"], since: at(22, 11) },
    rebecca: { status: "approved", folders: ["estate"], since: at(22, 11, 5) },
  };
  const f = (key: keyof typeof LIBRARY, id: string, day: number, extra: Partial<FileItem> = {}): FileItem => ({ ...LIBRARY[key], id, at: at(day, 9), sharedWith: [], ...extra });
  s.files = [
    f("ret2024", "f-1", 21),
    f("insurance", "f-2", 21, { at: at(21, 9, 20) }),
    f("beneficiary", "f-3", 23),
    f("ret2025", "f-4", 26, { sharedWith: ["elena"] }),
    f("trust", "f-5", 27),
  ];
  s.consents = [
    { id: "c-1", kind: "planner", rule: "regsp", title: "Approve Elena Brooks, CFP", detail: "All four folders.", person: "elena", folders: ["tax", "estate", "insurance", "investments"], requestedBy: "elena", at: at(20), needsBoth: false, signatures: { priya: at(20, 15) }, status: "approved" },
    { id: "c-2", kind: "7216", rule: "7216", title: "Let Gary share your 2025 return with Elena", detail: "Section 7216 consent.", fileId: "f-4", shareWith: ["elena"], requestedBy: "gary", at: at(26), needsBoth: true, signatures: { priya: at(26, 18), daniel: at(26, 20) }, status: "approved" },
  ];
  s.messages = [
    { id: "m-1", convId: "cv-team", by: "elena", at: at(22, 12), text: "Welcome, everyone. Anything shared here goes only to the people Daniel and Priya approve." },
    { id: "m-2", convId: "cv-team", by: "gary", at: at(26, 10), text: "The 2025 return is uploaded. It opens for Elena once you both sign the 7216 form." },
    { id: "m-3", convId: "cv-team", by: "priya", at: at(26, 18, 5), text: "Signed. Daniel will sign tonight.", },
    { id: "m-4", convId: "dm-elena-priya", by: "elena", at: at(28, 9), text: "Priya, the rollover IRA still names Daniel's mother. Can you two look at it this week?", fileId: "f-3" },
  ];
  s.conversations.push({ id: "dm-elena-priya", members: ["elena", "priya"] });
  s.activity = [
    { id: "a-1", at: at(20), actor: "elena", kind: "household", text: "added the Harper household" },
    { id: "a-2", at: at(20, 15), actor: "priya", kind: "approve", text: "approved Elena Brooks for all folders (Reg S-P)" },
    { id: "a-3", at: at(22, 11), actor: "priya", kind: "approve", text: "invited Gary Lindholm to the Tax folder" },
    { id: "a-4", at: at(22, 11, 5), actor: "priya", kind: "approve", text: "invited Rebecca Thorne to the Estate folder" },
    { id: "a-5", at: at(26, 9), actor: "gary", kind: "upload", text: "uploaded 2025 Form 1040 with schedules.pdf", fileId: "f-4" },
    { id: "a-6", at: at(26, 20), actor: "daniel", kind: "approve", text: "signed the 7216 form. The 2025 return is shared with Elena", fileId: "f-4" },
    { id: "a-7", at: at(27, 9), actor: "rebecca", kind: "upload", text: "uploaded Harper Family Trust, 2016.pdf (private to the attorney)", fileId: "f-5" },
  ].reverse() as HouseholdState["activity"];
  s.signedIn = ["elena", "gary", "rebecca", "priya", "daniel"];
  s.n = 20;
  return s;
}
