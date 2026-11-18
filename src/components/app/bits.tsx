"use client";
import { Calculator, Compass, Home, Info, Lock, Scale, ShieldAlert } from "lucide-react";
import type { FileItem, PersonId, Role } from "@/lib/demo/types";
import { useHousehold } from "@/lib/demo/store";
import { PEOPLE } from "@/lib/demo/seed";
import { blockedLine, isClient, whoCanSee } from "@/lib/demo/rules";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useUi } from "./ui-state";

export const ROLE_LABEL: Record<Role, string> = { planner: "Planner", cpa: "CPA", attorney: "Attorney", client: "Client" };

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  const I = role === "planner" ? Compass : role === "cpa" ? Calculator : role === "attorney" ? Scale : Home;
  return <I className={cn("size-4", className)} aria-hidden />;
}

export function Avatar({ id, size = "md", you }: { id: PersonId; size?: "sm" | "md" | "lg"; you?: boolean }) {
  const p = PEOPLE[id];
  const dims = size === "sm" ? "size-6 text-[0.62rem]" : size === "lg" ? "size-11 text-sm" : "size-8 text-xs";
  const style = p.role === "client" ? "bg-secondary text-foreground border border-border" : "bg-primary text-primary-foreground";
  return (
    <span className="relative inline-flex shrink-0" aria-hidden>
      <span className={cn("inline-flex select-none items-center justify-center rounded-full font-semibold tracking-tight", dims, style, you && "ring-2 ring-brand ring-offset-2 ring-offset-background")}>{p.initials}</span>
      {size !== "sm" && (
        <span className="absolute -bottom-1 -right-1 inline-flex size-[1.05rem] items-center justify-center rounded-full border border-border bg-background text-foreground">
          <RoleIcon role={p.role} className="size-[0.62rem]" />
        </span>
      )}
    </span>
  );
}

// Every file says who can see it.
export function VisibleTo({ file }: { file: FileItem }) {
  const s = useHousehold();
  const { me } = useUi();
  const who = whoCanSee(s, file);
  return (
    <span className="flex flex-wrap items-center gap-1 text-[0.78rem] text-muted-foreground">
      <span>Visible to</span>
      {who.map((p) => (
        <span key={p} className={cn("rounded-full border px-2 py-0.5 text-foreground", p === me && "border-brand bg-brand-soft")}>
          {p === me ? "you" : PEOPLE[p].first}
        </span>
      ))}
    </span>
  );
}

// The one-line rule shown on anything held or blocked.
export function RuleLine({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-[0.8rem] leading-snug text-foreground/80", className)}>
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

export function FileLock({ file }: { file: FileItem }) {
  const s = useHousehold();
  const { me } = useUi();
  return <RuleLine text={blockedLine(s, me, file)} />;
}

export function personLabel(p: PersonId) {
  return isClient(p) ? PEOPLE[p].name : `${PEOPLE[p].name}, ${PEOPLE[p].title}`;
}

// The page header band: white, edge to edge, so every screen starts with a clear title.
export function PageHeader({
  title,
  lead,
  actions,
  eyebrow,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-band mb-6 border-b pb-5 pt-1 @2xl:mb-8 @2xl:pb-7 @2xl:pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="eyebrow mb-3 flex items-center gap-2 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-[2.4rem] leading-[0.98] tracking-[-0.015em] text-foreground @2xl:text-[3.1rem]">{title}</h1>
          {lead && <p className="mt-2.5 max-w-[60ch] text-[0.95rem] leading-relaxed text-muted-foreground @2xl:mt-3 @2xl:text-[1rem]">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}

// A section of a screen: serif heading, an optional count, an optional action on the right.
export function Section({
  title,
  count,
  action,
  hint,
  children,
  className,
  id,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const hid = id ?? `s-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={hid} className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id={hid} className="flex items-baseline gap-2 font-display text-[1.55rem] leading-none">
          {title}
          {count !== undefined && <span className="font-sans text-[0.85rem] tabular text-muted-foreground">{count}</span>}
          {hint && <InfoTip>{hint}</InfoTip>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// A number that matters, big enough to read across a room.
export function Stat({
  label,
  value,
  sub,
  icon: I,
  dark,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ElementType;
  dark?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col items-start rounded-2xl p-4 text-left transition-colors",
        dark ? "band-dark" : "panel",
        onClick && (dark ? "hover:brightness-110" : "hover:border-foreground/30"),
      )}
    >
      <span className={cn("flex w-full items-center justify-between text-[0.82rem] font-medium", dark ? "text-white/70" : "text-muted-foreground")}>
        {label}
        {I && <I className={cn("size-4", dark ? "text-brand" : "text-foreground/50")} aria-hidden />}
      </span>
      <span className="mt-2 font-display text-[2.6rem] leading-none tabular">{value}</span>
      {sub && <span className={cn("mt-2 text-[0.8rem] leading-snug", dark ? "text-white/65" : "text-muted-foreground")}>{sub}</span>}
    </Tag>
  );
}

export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex size-5 translate-y-[-2px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label="More about this">
          <Info className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[18rem] font-sans text-[0.8rem] leading-snug">{children}</TooltipContent>
    </Tooltip>
  );
}

// Square icon tile used on list rows, so rows of different kinds are easy to tell apart.
export function IconTile({ icon: I, tone = "light", className }: { icon: React.ElementType; tone?: "light" | "dark" | "blue"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
        tone === "dark" && "bg-primary text-primary-foreground",
        tone === "light" && "border bg-secondary text-foreground",
        tone === "blue" && "bg-brand-soft text-foreground ring-1 ring-brand/40",
        className,
      )}
      aria-hidden
    >
      <I className="size-4" />
    </span>
  );
}

export function Empty({ icon: I, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/70 px-6 py-10 text-center">
      <I className="mb-3 size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-[46ch] text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function LockedNote({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium text-foreground/80">{title}</p>
        {children}
      </div>
    </div>
  );
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
