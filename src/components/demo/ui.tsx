"use client";
// Small building blocks. Black and white only.
import { useId } from "react";
import type { Role } from "@/lib/core/types";
import { ROLE_LABEL } from "@/lib/core/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="16 6 68 77.5" className={className} aria-hidden="true">
      <path fill="currentColor" d="M46.75 76 C46.75 68 43.1 60 43.1 46 C43.1 32 46.6 15 49.01 10.8 Q50 9.4 50.99 10.8 C53.4 15 56.9 32 56.9 46 C56.9 60 53.25 68 53.25 76 Z" />
      <g stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M51.80 61.00 A17.2 22 0 0 1 69.00 39.00 A8.5 8.5 0 0 1 75.51 52.96" />
        <path d="M48.20 61.00 A17.2 22 0 0 0 31.00 39.00 A8.5 8.5 0 0 0 24.49 52.96" />
        <path d="M50 72 V79.5" />
      </g>
      <circle cx="61.5" cy="21" r="4.2" fill="currentColor" />
      <circle cx="38.5" cy="21" r="4.2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[1.15rem] font-semibold tracking-tight", className)}>
      <Mark className="h-6 w-auto" />
      Catasto
    </span>
  );
}

// A light tap on phones that support it. Silent everywhere else.
export function tap() {
  try {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) navigator.vibrate?.(8);
  } catch {}
}

// Newly added things glow blue once, then settle.
export const fresh = (iso: string) => Date.now() - new Date(iso).getTime() < 4000;

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        tap();
        onChange(!on);
      }}
      className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200", on ? "border-brand bg-brand" : "border-strong bg-muted")}
    >
      <span className={cn("absolute top-[3px] size-4 rounded-full bg-background shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-[left] duration-300 ease-snap", on ? "left-[23px]" : "left-[3px]")} />
    </button>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" | "ghost"; size?: "sm" | "md" };
export function Btn({ variant = "solid", size = "md", className, onClick, ...p }: BtnProps) {
  return (
    <button
      {...p}
      onClick={(e) => {
        tap();
        onClick?.(e);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[0.8rem]",
        variant === "solid" && "bg-foreground text-background hover:bg-foreground/85",
        variant === "outline" && "border border-strong bg-background hover:bg-muted",
        variant === "ghost" && "hover:bg-muted",
        className,
      )}
    />
  );
}

// A text field. In the demo, clicking an empty field fills in the sample value.
export function Field({ label, value, onChange, sample, type = "text", autoFocus }: { label: string; value: string; onChange: (v: string) => void; sample?: string; type?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[0.8rem] font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => !value && sample && onChange(sample)}
        onClick={() => !value && sample && onChange(sample)}
        placeholder={sample ? "Click to fill" : undefined}
        className="h-10 w-full rounded-md border border-strong bg-background px-3 text-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)] focus:outline-none"
      />
    </div>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[2.4rem] leading-none tracking-tight">{children}</h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Panel({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-lg border bg-card", className)} />;
}

export function Pill({ children, solid }: { children: React.ReactNode; solid?: boolean }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium", solid ? "border-brand bg-brand-soft text-foreground" : "border-strong")}>{children}</span>;
}

export function RoleChip({ r }: { r: Role }) {
  return <span className="inline-flex h-6 items-center rounded border border-strong px-1.5 text-[0.72rem] font-medium">{ROLE_LABEL[r]}</span>;
}

export function Modal({ open, onClose, title, desc, children, wide }: { open: boolean; onClose: () => void; title: string; desc?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn("rounded-lg border bg-background", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle className="font-display text-[1.7rem] font-normal leading-none">{title}</DialogTitle>
          {desc ? <DialogDescription>{desc}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
