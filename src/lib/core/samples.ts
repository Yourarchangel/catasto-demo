// Fictional sample documents common in comprehensive planning. No real client data.
import type { Role } from "./types";

export interface Sample {
  id: string;
  name: string;
  size: string;
  for: Role; // whose workspace it usually belongs in
  lines: string[]; // what the viewer shows
}

export const SAMPLES: Sample[] = [
  { id: "plan", name: "2026 Financial plan.pdf", size: "1.2 MB", for: "adviser", lines: ["Financial plan, 2026", "Prepared for the Harper household", "Goals: retire at 62, fund two college accounts, leave a legacy gift", "Probability of success: 84% at current savings", "Next steps: raise 401(k) to the max, review beneficiaries, update the trust"] },
  { id: "networth", name: "Net worth statement.pdf", size: "220 KB", for: "adviser", lines: ["Net worth statement, as of Oct 31, 2026", "Assets: $3,412,000", "Liabilities: $388,000", "Net worth: $3,024,000"] },
  { id: "ips", name: "Investment policy statement.pdf", size: "310 KB", for: "adviser", lines: ["Investment policy statement", "Target mix: 65% stocks, 30% bonds, 5% cash", "Rebalance when any asset class drifts 5 points"] },
  { id: "1040", name: "2025 Form 1040.pdf", size: "2.4 MB", for: "cpa", lines: ["Form 1040, tax year 2025 (sample)", "Filing status: married filing jointly", "Adjusted gross income: $412,880", "Total tax: $86,214", "Schedule C and Schedule E attached"] },
  { id: "projection", name: "2026 Tax projection.xlsx", size: "96 KB", for: "cpa", lines: ["2026 tax projection", "Projected AGI: $431,000", "Roth conversion room in the 24% bracket: $38,000", "Estimated payments due: Jan 15 and Apr 15"] },
  { id: "k1", name: "Schedule K-1 (Harper Design LLC).pdf", size: "180 KB", for: "cpa", lines: ["Schedule K-1, tax year 2025 (sample)", "Ordinary business income: $96,400", "Guaranteed payments: $0"] },
  { id: "trust", name: "Revocable living trust (draft).pdf", size: "1.8 MB", for: "attorney", lines: ["Revocable living trust agreement (draft)", "Trustees: the clients, then the named successor trustee", "Schedule A lists assets to be retitled to the trust", "Draft for client review. Not signed."] },
  { id: "will", name: "Pour-over will.pdf", size: "640 KB", for: "attorney", lines: ["Last will and testament (pour-over)", "All remaining assets pass to the revocable trust", "Guardian named for minor children"] },
  { id: "poa", name: "Durable power of attorney.pdf", size: "410 KB", for: "attorney", lines: ["Durable power of attorney for finances", "Agent: spouse, then the named alternate", "Effective immediately"] },
  { id: "brokerage", name: "Brokerage statement Q3 2026.pdf", size: "880 KB", for: "client", lines: ["Brokerage statement, Jul 1 to Sep 30, 2026", "Account ending 4411 (sample)", "Ending value: $1,284,330"] },
  { id: "w2", name: "2025 W-2.pdf", size: "120 KB", for: "client", lines: ["Form W-2, tax year 2025 (sample)", "Wages: $286,000", "Federal tax withheld: $52,140"] },
  { id: "life", name: "Term life policy.pdf", size: "1.1 MB", for: "client", lines: ["Term life insurance policy (sample)", "Death benefit: $2,000,000", "Term: 20 years", "Beneficiary: spouse"] },
  { id: "beneficiary", name: "401(k) beneficiary form.pdf", size: "90 KB", for: "client", lines: ["Beneficiary designation (sample)", "Primary: spouse, 100%", "Contingent: revocable trust, 100%"] },
];

export const sampleById = (id?: string) => SAMPLES.find((s) => s.id === id);

// The first folder each workspace starts with.
export const DEFAULT_FOLDER: Record<Role, string> = {
  adviser: "Plan documents",
  client: "Statements",
  cpa: "Tax returns",
  attorney: "Estate documents",
};
