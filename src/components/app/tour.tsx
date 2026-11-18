"use client";
// The guided tour: five steps that follow how we expect Catasto to be adopted.
// Each step says how to use the screen and why it matters, in plain words.
// "Do it for me" runs the same actions as a click, consent rules included.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lightbulb, MousePointerClick, Wand2, X } from "lucide-react";
import type { HouseholdState, PersonId, Role, View } from "@/lib/demo/types";
import * as A from "@/lib/demo/store";
import { getState, useHousehold } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { useUi } from "./ui-state";

interface Step {
  seat: Role;
  view: View;
  after?: View;
  convId?: string;
  person: PersonId;
  target: string;
  title: string;
  use: string;
  why: string;
  action: string;
  done: (s: HouseholdState) => boolean;
  doIt: () => void;
}

const signedIn = (p: PersonId) => () => {
  if (!getState().signedIn.includes(p)) A.signIn(p);
};
const pend = (kind: string) => getState().consents.find((c) => c.kind === kind && c.status === "pending");
const returnFile = (s: HouseholdState) => s.files.find((f) => f.name.startsWith("2025 Form 1040"));

export const STEPS: Step[] = [
  {
    seat: "planner",
    view: "home",
    person: "elena",
    target: "add-household",
    title: "1. The planner adds a household",
    use: "Elena signs in with a link and a code, no password. Then she adds the Harpers and invites them.",
    why: "It starts with one planner and one family. Elena sees nothing yet. The clients decide first.",
    action: "Sign in, then click Add a household.",
    done: (s) => s.household.status === "active",
    doIt: () => {
      signedIn("elena")();
      A.addHousehold();
    },
  },
  {
    seat: "client",
    view: "home",
    person: "priya",
    target: "consent-card",
    title: "2. The client approves the planner",
    use: "Priya gets a text that says only \"You have something waiting.\" She signs in on her phone and approves Elena.",
    why: "Regulation S-P: the client says yes before a planner sees anything. It is saved in the log.",
    action: "Sign in, then click Approve.",
    done: (s) => s.members.elena.status === "approved",
    doIt: () => {
      signedIn("priya")();
      const c = pend("planner");
      if (c) A.signConsent(c.id, "priya");
    },
  },
  {
    seat: "client",
    view: "consent",
    person: "priya",
    target: "invite-team",
    title: "3. The client invites the CPA and attorney",
    use: "Priya invites Gary, her CPA, to the Tax folder and Rebecca, her attorney, to the Estate folder.",
    why: "They get their own app free, and they only see the folders Priya picked. She can take it back any time.",
    action: "Click Invite and pick folders for Gary and Rebecca.",
    done: (s) => s.members.gary.status === "approved" && s.members.rebecca.status === "approved",
    doIt: () => {
      signedIn("priya")();
      const s = getState();
      if (s.members.gary.status !== "approved") A.inviteMember("priya", "gary", ["tax"]);
      if (getState().members.rebecca.status !== "approved") A.inviteMember("priya", "rebecca", ["estate"]);
    },
  },
  {
    seat: "cpa",
    view: "files",
    after: "files",
    person: "gary",
    target: "upload",
    title: "4. The CPA shares the return, the clients sign 7216",
    use: "Gary uploads the 2025 return. Catasto holds it from Elena until Daniel and Priya both sign the 7216 form on their phones.",
    why: "IRC 7216: a CPA needs signed consent before a return goes to anyone else. The rule is built in, not a reminder.",
    action: "Upload into Tax. Then switch to the client seat and sign.",
    done: (s) => {
      const f = returnFile(s);
      return !!f && !f.hold;
    },
    doIt: () => {
      signedIn("gary")();
      if (!returnFile(getState())) A.addLibraryFile("ret2025", false);
      const c = pend("7216");
      if (c) {
        A.signConsent(c.id, "priya");
        A.signConsent(c.id, "daniel", true);
      }
    },
  },
  {
    seat: "planner",
    view: "messages",
    convId: "cv-team",
    person: "elena",
    target: "composer",
    title: "5. The team works in one place",
    use: "Elena now sees the return. She writes to the team and attaches it. Everyone sees the same thread.",
    why: "No more email chains and texted photos. Every message and file is private to the people the client approved.",
    action: "Write a message, attach the return, and send.",
    done: (s) => s.messages.some((m) => m.by === "elena" && m.convId === "cv-team"),
    doIt: () => {
      const f = returnFile(getState());
      A.sendMessage("cv-team", "elena", "Thanks, Gary. I have the 2025 return. Can we talk Thursday about the Roth contributions on line 4b?", f?.id);
      A.sendMessage("cv-team", "gary", "Yes. Thursday at 2 works. I will bring the amended numbers.", undefined, true);
    },
  },
];

function catchUp(i: number) {
  STEPS.slice(0, i + 1).forEach((st) => {
    if (!st.done(getState())) st.doIt();
  });
  signedIn(STEPS[i].person)();
}

export function Tour() {
  const s = useHousehold();
  const { ui, set } = useUi();
  const step = ui.tour === null ? null : STEPS[ui.tour];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);

  // Move to the step's seat and screen.
  useEffect(() => {
    if (!step) return;
    set({ seat: step.seat, view: step.view, convId: step.convId, clientActor: "priya", folder: "all" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.tour]);

  // Track the highlighted control.
  useLayoutEffect(() => {
    if (!step) return;
    let raf = 0;
    const tick = () => {
      const el = document.querySelector(`[data-tour="signin"]`) ?? document.querySelector(`[data-tour="${step.target}"]`);
      const r = el?.getBoundingClientRect() ?? null;
      setRect((old) => (old && r && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (!step) return;
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") set({ tour: null, tourDismissed: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, set]);

  if (ui.tour === null) {
    if (ui.tourDismissed) return null;
    return (
      <div className="panel fixed bottom-4 right-4 z-40 w-[20rem] max-w-[calc(100vw-2rem)] p-4" role="dialog" aria-label="Take the tour">
        <p className="font-semibold">New here? Take the 2-minute tour</p>
        <p className="mt-1 text-[0.88rem] text-muted-foreground">Five short steps: from a new household to the whole team working in one place.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => set({ tour: 0 })}>
            Take the tour
          </Button>
          <Button size="sm" variant="ghost" onClick={() => set({ tourDismissed: true })}>
            Not now
          </Button>
        </div>
      </div>
    );
  }
  if (!step) return null;
  const i = ui.tour;
  const done = step.done(s);
  const pad = 6;
  const W = 400;
  const below = rect ? rect.bottom + 360 < window.innerHeight : false;
  const actionable = true;

  return (
    <>
      {rect && (
        <div
          className="tour-ring pointer-events-none fixed z-[60]"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: Math.min(rect.height + pad * 2, window.innerHeight - rect.top + pad) }}
          aria-hidden
        />
      )}
      <div
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        className="fixed z-[70] w-[25rem] max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover p-5 shadow-2xl outline-none"
        style={
          rect && window.innerWidth > 900
            ? below
              ? { left: Math.min(Math.max(rect.left, 16), window.innerWidth - W - 16), top: Math.min(rect.bottom + 16, window.innerHeight - 380) }
              : rect.top > window.innerHeight / 2
                ? { right: 24, top: 110 }
                : { right: 24, bottom: 24 }
            : { left: 16, right: 16, bottom: 16, marginInline: "auto" }
        }
      >
        <div className="flex items-center justify-between text-[0.78rem] text-muted-foreground">
          <span>
            Step {i + 1} of {STEPS.length}
          </span>
          <button onClick={() => set({ tour: null, tourDismissed: true })} className="inline-flex items-center gap-1 rounded px-1 hover:text-foreground">
            <X className="size-3.5" aria-hidden /> Skip tour
          </button>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={`h-1 flex-1 rounded-full ${k < i ? "bg-foreground" : k === i ? "bg-brand" : "bg-border"}`} />
          ))}
        </div>
        <h2 id="tour-title" className="mt-4 font-display text-[1.6rem] leading-tight">
          {step.title}
        </h2>
        <div className="mt-3 space-y-2.5">
          <p className="flex gap-2.5 text-[0.9rem] leading-relaxed">
            <MousePointerClick className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-semibold">How to use it. </span>
              {step.use}
            </span>
          </p>
          <p className="flex gap-2.5 text-[0.9rem] leading-relaxed">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-semibold">Why it matters. </span>
              {step.why}
            </span>
          </p>
        </div>
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-[0.88rem] font-medium" role="status">
          {done && actionable ? <Check className="size-4" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
          {done && actionable ? "Done. Press Next." : step.action}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => set({ tour: i - 1 })}>
            <ArrowLeft aria-hidden /> Back
          </Button>
          <div className="flex-1" />
          {!done && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                catchUp(i);
                set({ seat: step.seat, view: step.after ?? step.view, convId: step.convId });
              }}
            >
              <Wand2 aria-hidden /> Do it for me
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (!done) catchUp(i);
              set(i + 1 < STEPS.length ? { tour: i + 1 } : { tour: null, tourDismissed: true });
            }}
          >
            {i + 1 < STEPS.length ? "Next" : "Finish"} <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </>
  );
}
