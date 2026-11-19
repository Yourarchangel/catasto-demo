// The two starting points of the demo. Fictional people only.
import type { DemoState, Household, Member, Role } from "./types";
import { DEFAULT_FOLDER } from "./samples";

const ADVISER = { name: "Elena Lindholm", email: "elena@lindholm.example", firm: "Lindholm Planning" };

export const PEOPLE: Record<Role, { name: string; email: string; phone: string }> = {
  adviser: { name: ADVISER.name, email: ADVISER.email, phone: "(214) 555-0140" },
  client: { name: "Priya Harper", email: "priya@harper.example", phone: "(214) 555-0182" },
  cpa: { name: "Gary Oduya", email: "gary@oduyacpa.example", phone: "(214) 555-0117" },
  attorney: { name: "Rebecca Stone", email: "rebecca@stonelaw.example", phone: "(214) 555-0163" },
};

const day = (d: number, h = 10) => new Date(Date.UTC(2026, 10, d, h, 0)).toISOString();

export function emptyMembers(): Record<Role, Member> {
  return {
    adviser: { status: "joined", ...PEOPLE.adviser },
    client: { status: "none" },
    cpa: { status: "none" },
    attorney: { status: "none" },
  };
}

export function defaultFolders(prefix: string) {
  return (["adviser", "client", "cpa", "attorney"] as Role[]).map((r) => ({ id: `${prefix}-${r}`, owner: r, name: DEFAULT_FOLDER[r], grants: [] as Role[] }));
}

// Part 1: nothing set up. The adviser is signed out.
export function part1(): DemoState {
  return { part: 1, view: "adviser", adviserAuth: "signed-out", adviser: ADVISER, households: [], n: 1 };
}

// Part 2: a whole team is set up and working.
export function part2(): DemoState {
  const joined = (r: Role, d: number): Member => ({ status: "joined", ...PEOPLE[r], joinedAt: day(d) });
  const harper: Household = {
    id: "h-harper",
    name: "Harper household",
    createdAt: day(2),
    members: { adviser: joined("adviser", 2), client: joined("client", 3), cpa: joined("cpa", 4), attorney: joined("attorney", 5) },
    consent: { typedName: "Priya Harper", signedAt: day(3), sweeping: false },
    folders: [
      { id: "f-plan", owner: "adviser", name: "Plan documents", grants: ["cpa", "attorney"] },
      { id: "f-stmt", owner: "client", name: "Statements", grants: ["adviser", "cpa"] },
      { id: "f-ins", owner: "client", name: "Insurance", grants: ["adviser"] },
      { id: "f-tax", owner: "cpa", name: "Tax returns", grants: ["adviser"] },
      { id: "f-est-pay", owner: "cpa", name: "Estimated payments", grants: [] },
      { id: "f-estate", owner: "attorney", name: "Estate documents", grants: ["adviser"] },
      { id: "f-poa", owner: "attorney", name: "Powers of attorney", grants: [] },
    ],
    files: [
      { id: "x1", folderId: "f-plan", name: "2026 Financial plan.pdf", size: "1.2 MB", uploadedBy: "adviser", at: day(8), sampleId: "plan" },
      { id: "x2", folderId: "f-plan", name: "Net worth statement.pdf", size: "220 KB", uploadedBy: "adviser", at: day(8), sampleId: "networth" },
      { id: "x3", folderId: "f-stmt", name: "Brokerage statement Q3 2026.pdf", size: "880 KB", uploadedBy: "client", at: day(6), sampleId: "brokerage" },
      { id: "x4", folderId: "f-stmt", name: "2025 W-2.pdf", size: "120 KB", uploadedBy: "client", at: day(6), sampleId: "w2" },
      { id: "x5", folderId: "f-ins", name: "Term life policy.pdf", size: "1.1 MB", uploadedBy: "client", at: day(7), sampleId: "life" },
      { id: "x6", folderId: "f-tax", name: "2025 Form 1040.pdf", size: "2.4 MB", uploadedBy: "cpa", at: day(9), sampleId: "1040" },
      { id: "x7", folderId: "f-est-pay", name: "2026 Tax projection.xlsx", size: "96 KB", uploadedBy: "cpa", at: day(12), sampleId: "projection" },
      { id: "x8", folderId: "f-estate", name: "Revocable living trust (draft).pdf", size: "1.8 MB", uploadedBy: "attorney", at: day(11), sampleId: "trust" },
      { id: "x9", folderId: "f-estate", name: "Pour-over will.pdf", size: "640 KB", uploadedBy: "attorney", at: day(11), sampleId: "will" },
      { id: "x10", folderId: "f-poa", name: "Durable power of attorney.pdf", size: "410 KB", uploadedBy: "attorney", at: day(11), sampleId: "poa" },
    ],
    requests: [
      { id: "q1", folderId: "f-tax", forRole: "attorney", requestedBy: "attorney", at: day(13), status: "pending" },
      { id: "q2", folderId: "f-est-pay", forRole: "adviser", requestedBy: "cpa", at: day(13, 14), status: "pending" },
    ],
    threads: [
      { id: "t-team", members: ["adviser", "client", "cpa", "attorney"], title: "Whole team" },
      { id: "t-ac", members: ["adviser", "cpa"] },
      { id: "t-cl-att", members: ["client", "attorney"] },
    ],
    messages: [
      { id: "m1", threadId: "t-team", by: "adviser", text: "Welcome, everyone. The plan is in my workspace. Please send anything you need from each other through here.", at: day(8, 15) },
      { id: "m2", threadId: "t-team", by: "attorney", text: "Trust draft is uploaded. Once it's signed we'll need account titles updated.", at: day(11, 16) },
      { id: "m3", threadId: "t-team", by: "client", text: "Thank you. I uploaded the life policy too.", at: day(12, 9) },
      { id: "m4", threadId: "t-ac", by: "adviser", text: "Do you have room for a Roth conversion this year?", at: day(12, 11) },
      { id: "m5", threadId: "t-ac", by: "cpa", text: "About $38,000 in the 24% bracket. It's in the projection. I've asked the client to share that folder with you.", at: day(13, 14) },
      { id: "m6", threadId: "t-cl-att", by: "attorney", text: "I'd like to see the 2025 return to confirm the trust funding plan. I sent a request.", at: day(13, 10) },
    ],
    audit: [],
  };
  const other = (id: string, name: string, d: number): Household => ({
    id, name, createdAt: day(d), members: emptyMembers(), folders: defaultFolders(id), files: [], requests: [], threads: [], messages: [], audit: [],
  });
  return {
    part: 2,
    view: "adviser",
    adviserAuth: "in",
    adviser: ADVISER,
    households: [harper, other("h-okafor", "Okafor household", 9), other("h-brennan", "Brennan household", 14)],
    n: 100,
  };
}
