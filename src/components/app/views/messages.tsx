"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Paperclip, Plus, Send, Users } from "lucide-react";
import type { Conversation, FileItem, PersonId } from "@/lib/demo/types";
import { markRead, openDirect, sendMessage, unread, useHousehold } from "@/lib/demo/store";
import { PEOPLE } from "@/lib/demo/seed";
import { canMessage, canSeeFile, convVisible, isActive, isClient, visibleFiles } from "@/lib/demo/rules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, FileLock, PageHeader, timeAgo } from "../bits";
import { FileViewer, NotYet, UploadDialog } from "./files";
import { useUi } from "../ui-state";
import { cn } from "@/lib/utils";

function label(c: Conversation, me: PersonId) {
  if (c.title) return c.title;
  const other = c.members.find((m) => m !== me) ?? me;
  return PEOPLE[other].name;
}

function Attachment({ f }: { f: FileItem }) {
  const s = useHousehold();
  const { me } = useUi();
  const [open, setOpen] = useState(false);
  if (!canSeeFile(s, me, f))
    return (
      <div className="mt-2 rounded-lg border border-dashed bg-background p-2.5 text-left">
        <p className="flex items-center gap-1.5 text-[0.85rem] font-medium">
          <Lock className="size-3.5" aria-hidden /> A file you cannot open
        </p>
        <FileLock file={f} />
      </div>
    );
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 flex w-full items-center gap-2 rounded-lg border bg-background p-2.5 text-left text-[0.85rem] text-foreground hover:border-foreground/30">
        <Paperclip className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate font-medium">{f.name}</span>
      </button>
      {open && <FileViewer file={f} onClose={() => setOpen(false)} />}
    </>
  );
}

function Thread({ c, onBack }: { c: Conversation; onBack?: () => void }) {
  const s = useHousehold();
  const { me } = useUi();
  const msgs = s.messages.filter((m) => m.convId === c.id);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    markRead(c.id, me);
    end.current?.scrollIntoView({ block: "end" });
  }, [c.id, msgs.length, me]);
  const who = c.members.filter((m) => convVisible(s, m, c.members));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to conversations">
            <ArrowLeft aria-hidden />
          </Button>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-[1.3rem] leading-tight">{label(c, me)}</p>
          <p className="flex items-center gap-1 text-[0.75rem] text-muted-foreground">
            <Lock className="size-3" aria-hidden /> Only {who.map((p) => (p === me ? "you" : PEOPLE[p].first)).join(", ")} can see this
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello.</p>}
        {msgs.map((m) => {
          const mine = m.by === me;
          const f = m.fileId ? s.files.find((x) => x.id === m.fileId) : undefined;
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              {!mine && <Avatar id={m.by} size="sm" />}
              <div className={cn("max-w-[78%]", mine && "text-right")}>
                <p className="mb-0.5 text-[0.72rem] text-muted-foreground">
                  {mine ? "You" : PEOPLE[m.by].first}, {timeAgo(m.at)}
                  {m.simulated && " · simulated"}
                </p>
                <div className={cn("inline-block rounded-2xl px-3.5 py-2 text-left text-[0.92rem]", mine ? "bg-primary text-primary-foreground" : "border bg-card")}>
                  {m.text}
                  {f && <Attachment f={f} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <Composer c={c} />
    </div>
  );
}

function Composer({ c }: { c: Conversation }) {
  const s = useHousehold();
  const { me } = useUi();
  const [text, setText] = useState("");
  const [fileId, setFileId] = useState<string>();
  const [up, setUp] = useState(false);
  const mine = visibleFiles(s, me);
  const file = fileId ? s.files.find((f) => f.id === fileId) : undefined;
  const send = () => {
    if (!text.trim() && !fileId) return;
    sendMessage(c.id, me, text.trim() || "Sharing a file.", fileId);
    setText("");
    setFileId(undefined);
  };
  return (
    <form
      className="border-t bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      data-tour="composer"
    >
      {file && (
        <p className="mb-2 flex items-center gap-2 text-[0.8rem]">
          <Paperclip className="size-3.5" aria-hidden /> {file.name}
          <button type="button" className="text-muted-foreground underline" onClick={() => setFileId(undefined)}>
            Remove
          </button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="Attach a file">
              <Paperclip aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem onSelect={() => setUp(true)}>
              <Plus aria-hidden /> Upload a new file
            </DropdownMenuItem>
            {mine.length > 0 && <DropdownMenuSeparator />}
            {mine.length > 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">From your files</DropdownMenuLabel>}
            {mine.slice(0, 8).map((f) => (
              <DropdownMenuItem key={f.id} onSelect={() => setFileId(f.id)}>
                <span className="truncate">{f.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <label htmlFor={`msg-${c.id}`} className="sr-only">
          Message
        </label>
        <Textarea
          id={`msg-${c.id}`}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message"
          className="max-h-40 min-h-11 resize-none bg-background text-[0.95rem]"
        />
        <Button type="submit" className="h-11" aria-label="Send message">
          <Send aria-hidden /> <span className="hidden @lg:inline">Send</span>
        </Button>
      </div>
      {up && <UploadDialog onClose={() => setUp(false)} onDone={(id) => setFileId(id)} />}
    </form>
  );
}

function NewMessage() {
  const s = useHousehold();
  const { me, set } = useUi();
  const people = (["elena", "gary", "rebecca", "priya", "daniel"] as PersonId[]).filter((p) => p !== me);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus aria-hidden /> New message
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {people.map((p) => {
          const ok = canMessage(s, p);
          return (
            <DropdownMenuItem key={p} disabled={!ok} onSelect={() => set({ convId: openDirect(me, p) })} className="flex-col items-start">
              <span>{PEOPLE[p].name}</span>
              {!ok && <span className="text-xs text-muted-foreground">Joins once the clients approve them</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MessagesView() {
  const s = useHousehold();
  const { me, ui, set } = useUi();
  const client = isClient(me);
  const convs = s.conversations.filter((c) => convVisible(s, me, c.members) && (c.title || s.messages.some((m) => m.convId === c.id) || c.id === ui.convId));
  const current = convs.find((c) => c.id === ui.convId) ?? (client ? undefined : convs[0]);
  if (!isActive(s, me))
    return (
      <div>
        <PageHeader eyebrow="Secure Message" title="Messages" />
        <NotYet />
      </div>
    );
  const list = (
    <ul className="space-y-1 p-2">
      {convs.map((c) => {
        const n = unread(s, me, c.id);
        const last = s.messages.filter((m) => m.convId === c.id).at(-1);
        return (
          <li key={c.id}>
            <button onClick={() => set({ convId: c.id })} aria-current={current?.id === c.id ? "true" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl p-3 text-left", current?.id === c.id ? "bg-card shadow-[0_0_0_1px_var(--border)]" : "hover:bg-accent")}>
              {c.title ? (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Users className="size-4" aria-hidden />
                </span>
              ) : (
                <Avatar id={c.members.find((m) => m !== me) ?? me} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2">
                  <span className={cn("truncate", n ? "font-semibold" : "font-medium")}>{label(c, me)}</span>
                  {n > 0 && <span className="rounded-full bg-brand px-1.5 text-[0.7rem] font-semibold">{n}</span>}
                </span>
                <span className="block truncate text-[0.8rem] text-muted-foreground">{last ? `${last.by === me ? "You" : PEOPLE[last.by].first}: ${last.text}` : "No messages yet"}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  if (client)
    return current ? (
      <div className="-mx-4 -my-5 flex h-[calc(100%+2.5rem)] flex-col">
        <Thread c={current} onBack={() => set({ convId: undefined })} />
      </div>
    ) : (
      <div>
        <div className="mb-4 flex items-end justify-between gap-2">
          <h1 className="font-display text-[2.2rem] leading-none">Messages</h1>
          <NewMessage />
        </div>
        <div className="panel" data-tour="conversations">
          {list}
        </div>
      </div>
    );
  return (
    <div>
      <PageHeader eyebrow="Secure Message" title="Messages" lead="Talk with the client's team in one place. Only the people in a conversation can read it." actions={<NewMessage />} />
      <div className="panel grid h-[min(40rem,calc(100vh-var(--demo-h)-15rem))] min-h-[30rem] grid-rows-[auto_minmax(0,1fr)] overflow-hidden @3xl:grid-cols-[18rem_minmax(0,1fr)] @3xl:grid-rows-1">
        <div className="max-h-36 overflow-y-auto border-b bg-secondary/40 @3xl:max-h-none @3xl:border-b-0 @3xl:border-r">{list}</div>
        {current ? <Thread c={current} /> : <p className="p-6 text-sm text-muted-foreground">Pick a conversation.</p>}
      </div>
    </div>
  );
}
