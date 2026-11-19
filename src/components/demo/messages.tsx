"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Plus, Send } from "lucide-react";
import type { Household, Role, Thread } from "@/lib/core/types";
import { ROLE_LABEL, ROLES } from "@/lib/core/types";
import { openThread, send } from "@/lib/core/api";
import { isJoined, threadsFor } from "@/lib/core/rules";
import { Btn, Empty, Modal, when } from "./ui";
import { cn } from "@/lib/utils";

const name = (t: Thread, me: Role) => t.title ?? t.members.filter((r) => r !== me).map((r) => ROLE_LABEL[r]).join(", ");

export function MessagesTab({ h, me }: { h: Household; me: Role }) {
  const threads = threadsFor(h, me);
  const [sel, setSel] = useState<string | undefined>(threads[0]?.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pick, setPick] = useState(false);
  const cur = threads.find((t) => t.id === sel) ?? threads[0];
  const last = (t: Thread) => h.messages.filter((m) => m.threadId === t.id).at(-1);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[0.8rem] text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Only the people in a conversation can read it.
        </p>
        <Btn size="sm" onClick={() => setPick(true)}>
          <Plus className="size-3.5" aria-hidden /> New message
        </Btn>
      </div>
      {threads.length === 0 ? (
        <Empty>No conversations yet. Start one once someone else has joined.</Empty>
      ) : (
        <div className="grid min-h-[26rem] overflow-hidden rounded-lg border md:grid-cols-[15rem_1fr]">
          <ul className={cn("divide-y border-r", mobileOpen && "hidden md:block")}>
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => {
                    setSel(t.id);
                    setMobileOpen(true);
                  }}
                  className={cn("w-full px-4 py-3 text-left", cur?.id === t.id ? "bg-muted" : "hover:bg-muted/60")}
                >
                  <span className="block text-sm font-medium">{name(t, me)}</span>
                  <span className="block truncate text-[0.75rem] text-muted-foreground">{last(t) ? `${last(t)!.by === me ? "You" : ROLE_LABEL[last(t)!.by]}: ${last(t)!.text}` : "No messages yet"}</span>
                </button>
              </li>
            ))}
          </ul>
          {cur && (
            <div className={cn("flex min-h-[26rem] flex-col", !mobileOpen && "hidden md:flex")}>
              <Conversation h={h} me={me} t={cur} onBack={() => setMobileOpen(false)} />
            </div>
          )}
        </div>
      )}
      {pick && (
        <NewMessage
          h={h}
          me={me}
          onClose={() => setPick(false)}
          onPick={(members) => {
            const tid = openThread(h.id, me, members);
            setSel(tid);
            setMobileOpen(true);
            setPick(false);
          }}
        />
      )}
    </div>
  );
}

function Conversation({ h, me, t, onBack }: { h: Household; me: Role; t: Thread; onBack: () => void }) {
  const msgs = h.messages.filter((m) => m.threadId === t.id);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, t.id]);
  const go = () => {
    if (!text.trim()) return;
    send(h.id, me, t.id, text.trim());
    setText("");
  };
  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button className="md:hidden" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <p className="text-sm font-semibold">{name(t, me)}</p>
          <p className="text-[0.72rem] text-muted-foreground">{t.members.map((r) => (r === me ? "You" : ROLE_LABEL[r])).join(", ")}</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>}
        {msgs.map((m) => {
          const mine = m.by === me;
          return (
            <div key={m.id} className={cn("flex", mine && "justify-end")}>
              <div className={cn("max-w-[80%]", mine && "text-right")}>
                <p className="mb-0.5 text-[0.7rem] text-muted-foreground">
                  {mine ? "You" : ROLE_LABEL[m.by]} · {when(m.at)}
                </p>
                <p className={cn("inline-block rounded-lg px-3 py-2 text-left text-sm", mine ? "bg-foreground text-background" : "border")}>{m.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <label htmlFor="msg" className="sr-only">
          Message
        </label>
        <input id="msg" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a secure message" className="h-10 flex-1 rounded-md border border-strong px-3 text-sm focus:border-foreground focus:outline-none" />
        <Btn aria-label="Send">
          <Send className="size-4" aria-hidden />
        </Btn>
      </form>
    </>
  );
}

function NewMessage({ h, me, onClose, onPick }: { h: Household; me: Role; onClose: () => void; onPick: (r: Role[]) => void }) {
  const [pick, setPick] = useState<Role[]>([]);
  const others = ROLES.filter((r) => r !== me);
  return (
    <Modal open onClose={onClose} title="New message" desc="Pick one person for a direct message, or several for a group chat.">
      <div className="space-y-2">
        {others.map((r) => {
          const ok = isJoined(h, r);
          return (
            <label key={r} className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm", !ok && "opacity-40", pick.includes(r) ? "border-foreground" : "border-strong")}>
              <input type="checkbox" className="accent-black" disabled={!ok} checked={pick.includes(r)} onChange={(e) => setPick((p) => (e.target.checked ? [...p, r] : p.filter((x) => x !== r)))} />
              <span className="flex-1">{ROLE_LABEL[r]}</span>
              {!ok && <span className="text-[0.72rem]">Not joined</span>}
            </label>
          );
        })}
      </div>
      <Btn disabled={!pick.length} onClick={() => onPick(pick)}>
        {pick.length > 1 ? "Start group chat" : "Start conversation"}
      </Btn>
    </Modal>
  );
}
