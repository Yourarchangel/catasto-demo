"use client";
import { useState } from "react";
import { ShieldCheck, Smartphone } from "lucide-react";
import type { Household, Role } from "@/lib/core/types";
import { ROLE_LABEL } from "@/lib/core/types";
import { adviserPassword, adviserVerified, inviteLink, join, signConsent } from "@/lib/core/api";
import { PEOPLE } from "@/lib/core/seed";
import { Btn, Field, Logo, Panel } from "./ui";
import { cn } from "@/lib/utils";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-2.25rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        {children}
      </div>
    </div>
  );
}

// Six code boxes. Click any box to fill the code from the "authenticator app".
function CodeBoxes({ value, onFill }: { value: string; onFill: () => void }) {
  return (
    <button type="button" onClick={onFill} className="flex w-full justify-between gap-2" aria-label={value ? `Code ${value}` : "Click to fill the code"}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={cn("flex h-12 flex-1 items-center justify-center rounded-md border text-lg font-semibold tabular-nums", value ? "border-foreground" : "border-strong text-muted-foreground")}>
          {value[i] ?? ""}
        </span>
      ))}
    </button>
  );
}

function Mfa({ onDone, setup }: { onDone: () => void; setup?: boolean }) {
  const [code, setCode] = useState("");
  return (
    <>
      <h1 className="font-display text-[2.2rem] leading-none">{setup ? "Set up two-step sign-in" : "Two-step verification"}</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        {setup ? "Scan this with your authenticator app, then enter the 6-digit code it shows." : "Enter the 6-digit code from your authenticator app."}
      </p>
      {setup && (
        <div className="mb-6 flex items-center gap-4">
          <QR />
          <p className="text-[0.8rem] text-muted-foreground">Works with Microsoft Authenticator, Google Authenticator or any TOTP app.</p>
        </div>
      )}
      <div className="mb-2 flex items-center gap-2 text-[0.8rem] font-medium">
        <Smartphone className="size-4" aria-hidden /> Authenticator code
      </div>
      <CodeBoxes value={code} onFill={() => setCode("482913")} />
      {!code && <p className="mt-2 text-[0.75rem] text-muted-foreground">Click the boxes to fill the code.</p>}
      <Btn className="mt-6 w-full" disabled={code.length < 6} onClick={onDone}>
        <ShieldCheck className="size-4" aria-hidden /> Verify
      </Btn>
    </>
  );
}

function QR() {
  // a fixed, fake QR pattern
  const cells = Array.from({ length: 121 }, (_, i) => ((i * 37 + (i % 11) * 13) % 7 < 3 ? 1 : 0));
  return (
    <svg viewBox="0 0 11 11" className="size-24 shrink-0 rounded border p-1.5" aria-label="QR code">
      {cells.map((c, i) => (c ? <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" /> : null))}
      {[0, 7].map((x) => [0, 7].map((y) => (x === 7 && y === 7 ? null : <g key={`${x}${y}`}><rect x={x} y={y} width="4" height="4" fill="#fff" /><rect x={x} y={y} width="4" height="4" fill="none" stroke="#000" strokeWidth=".8" transform="translate(.4 .4) scale(.8)" /><rect x={x + 1.3} y={y + 1.3} width="1.4" height="1.4" /></g>)))}
    </svg>
  );
}

export function AdviserSignIn({ step }: { step: "signed-out" | "mfa" }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  return (
    <Card>
      {step === "mfa" ? (
        <Mfa onDone={adviserVerified} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            adviserPassword();
          }}
        >
          <h1 className="font-display text-[2.2rem] leading-none">Sign in</h1>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">Secure sign-in with two-step verification.</p>
          <div className="space-y-4">
            <Field label="Email" value={email} onChange={setEmail} sample={PEOPLE.adviser.email} autoFocus />
            <Field label="Password" type="password" value={pw} onChange={setPw} sample="demo-password" />
          </div>
          <Btn className="mt-6 w-full" disabled={!email || !pw}>
            Continue
          </Btn>
        </form>
      )}
    </Card>
  );
}

// An invited CPA, attorney or client: accept, create an account, set up MFA.
export function JoinFlow({ h, role }: { h: Household; role: Role }) {
  const m = h.members[role];
  const [step, setStep] = useState<"invite" | "account" | "mfa">("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const sample = { name: m.name || PEOPLE[role].name, email: m.email || PEOPLE[role].email, phone: m.phone || PEOPLE[role].phone };
  return (
    <Card>
      {step === "invite" && (
        <>
          <h1 className="font-display text-[2.2rem] leading-none">You&apos;re invited</h1>
          <p className="mt-3 text-sm">
            The Adviser invited you to join <b>{h.name}</b> on Catasto as the <b>{ROLE_LABEL[role]}</b>.
          </p>
          <Panel className="mt-5 p-3 text-[0.75rem]">
            <p className="break-all font-mono">{inviteLink(m.invite!.token)}</p>
            <p className="mt-1 text-muted-foreground">One use. Expires {new Date(m.invite!.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
          </Panel>
          {role !== "client" && <p className="mt-4 text-[0.8rem] text-muted-foreground">It&apos;s free for you. You&apos;ll see only what the client approves.</p>}
          <Btn className="mt-6 w-full" onClick={() => setStep("account")}>
            Accept invitation
          </Btn>
        </>
      )}
      {step === "account" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep("mfa");
          }}
        >
          <h1 className="font-display text-[2.2rem] leading-none">Create your account</h1>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">As the {ROLE_LABEL[role]} for {h.name}.</p>
          <div className="space-y-4">
            <Field label="Full name" value={name} onChange={setName} sample={sample.name} autoFocus />
            <Field label="Email" value={email} onChange={setEmail} sample={sample.email} />
            <Field label="Phone" value={phone} onChange={setPhone} sample={sample.phone} />
            <Field label="Password" type="password" value={pw} onChange={setPw} sample="demo-password" />
          </div>
          <Btn className="mt-6 w-full" disabled={!name || !email || !pw}>
            Continue
          </Btn>
        </form>
      )}
      {step === "mfa" && <Mfa setup onDone={() => join(h.id, role, { name, email, phone })} />}
    </Card>
  );
}

const CONSENT_TEXT =
  "I allow the professionals I approve in Catasto to receive and share my financial, tax and estate information for my planning. I decide who sees each folder. I can change or take back this consent at any time.";

export function ClientConsent({ h }: { h: Household }) {
  const [agree, setAgree] = useState(false);
  const [typed, setTyped] = useState("");
  const [sweeping, setSweeping] = useState(false);
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Logo className="mb-8" />
      <h1 className="font-display text-[2.4rem] leading-none">Information sharing consent</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">One time, before anyone on your team can see your documents.</p>
      <Panel className="p-5 text-sm leading-relaxed">{CONSENT_TEXT}</Panel>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-black" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read and agree.
      </label>
      <fieldset className="mt-6">
        <legend className="mb-2 text-[0.8rem] font-medium">When a professional wants to see another professional&apos;s folder</legend>
        <div className="space-y-2">
          {[
            [false, "Ask me each time", "You approve every request."],
            [true, "Let them see each other's folders", "Your adviser, CPA and attorney can see each other's folders without asking. You can change this later."],
          ].map(([v, t, d]) => (
            <label key={String(v)} className={cn("flex cursor-pointer gap-3 rounded-md border p-3", sweeping === v ? "border-foreground" : "border-strong")}>
              <input type="radio" name="sweep" className="mt-1 accent-black" checked={sweeping === v} onChange={() => setSweeping(v as boolean)} />
              <span>
                <span className="block text-sm font-medium">{t as string}</span>
                <span className="block text-[0.8rem] text-muted-foreground">{d as string}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6">
        <Field label="Type your full name to sign" value={typed} onChange={setTyped} sample={h.members.client.name || PEOPLE.client.name} />
      </div>
      <Btn className="mt-6 w-full" disabled={!agree || !typed} onClick={() => signConsent(h.id, typed, sweeping)}>
        Sign and continue
      </Btn>
    </div>
  );
}
