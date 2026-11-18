"use client";
// The opening screen. The giglio forms from stars, as on the website, then the product fades in.
// Ported from catasto-site/assets/js/site.js (the hero constellation), so the two feel like one company.
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import type { Role } from "@/lib/demo/types";

// The mark, drawn in a 100-unit box. Same paths as the website.
const SHAPES = [
  { k: "fill", d: "M46.75 76 C46.75 68 43.1 60 43.1 46 C43.1 32 46.6 15 49.01 10.8 Q50 9.4 50.99 10.8 C53.4 15 56.9 32 56.9 46 C56.9 60 53.25 68 53.25 76 Z" },
  { k: "line", d: "M51.80 61.00 A17.2 22 0 0 1 69.00 39.00 A8.5 8.5 0 0 1 75.51 52.96" },
  { k: "dot", cx: 61.5, cy: 21, r: 4.2 },
  { k: "line", d: "M48.20 61.00 A17.2 22 0 0 0 31.00 39.00 A8.5 8.5 0 0 0 24.49 52.96" },
  { k: "dot", cx: 38.5, cy: 21, r: 4.2 },
  { k: "line", d: "M50 72 V79.5" },
] as const;
const SC = 3.7;
const OX = 115;
const OY = 137.2;
const PAD = 0.12;

function Constellation() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const src = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const svg = src.current;
    if (!cv || !svg) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type P = { tx: number; ty: number; sx: number; sy: number; x: number; y: number; big: boolean; end: boolean; delay: number; tw: number };
    type S = { kind: string; path?: Path2D; len: number; el?: SVGPathElement; first: number; last: number; closed: boolean };
    const pts: P[] = [];
    const shapes: S[] = [];
    const mk = (tx: number, ty: number, big: boolean, end: boolean): P => {
      const ang = Math.random() * Math.PI * 2;
      const rad = 200 + Math.random() * 220;
      return { tx, ty, sx: 300 + Math.cos(ang) * rad, sy: 300 + Math.sin(ang) * rad, x: 0, y: 0, big, end, delay: Math.random() * 0.8, tw: Math.random() * Math.PI * 2 };
    };
    svg.querySelectorAll<SVGElement>("[data-k]").forEach((el) => {
      const kind = el.getAttribute("data-k")!;
      if (kind === "dot") {
        pts.push(mk(OX + +el.getAttribute("cx")! * SC, OY + +el.getAttribute("cy")! * SC, true, false));
        shapes.push({ kind, len: 0, first: 0, last: 0, closed: false });
        return;
      }
      const pe = el as SVGPathElement;
      const len = pe.getTotalLength();
      const n = Math.max(4, Math.round(len / (kind === "fill" ? 3.4 : 3.6)));
      const closed = kind === "fill";
      const first = pts.length;
      for (let i = 0; i <= (closed ? n - 1 : n); i++) {
        const p = pe.getPointAtLength((len * i) / n);
        pts.push(mk(OX + p.x * SC, OY + p.y * SC, false, !closed && (i === 0 || i === n)));
      }
      shapes.push({ kind, path: new Path2D(pe.getAttribute("d")!), len, el: pe, first, last: pts.length - 1, closed });
    });
    const links: [number, number][] = [];
    shapes.forEach((s) => {
      if (s.kind === "dot") return;
      for (let i = s.first; i < s.last; i++) links.push([i, i + 1]);
      if (s.closed) links.push([s.last, s.first]);
    });
    const field = Array.from({ length: 46 }, () => ({ x: Math.random() * 600, y: Math.random() * 600, r: Math.random() * 0.8 + 0.4, tw: Math.random() * 6.28 }));
    const runner = shapes.find((s) => s.closed);

    let W = 0;
    let H = 0;
    let dpr = 1;
    let k = 1;
    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      W = r.width;
      H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      k = W / (600 * (1 + 2 * PAD));
    };
    const X = (x: number) => Math.round((x + 600 * PAD) * k * dpr) / dpr;
    const Y = (y: number) => Math.round((y + 600 * PAD) * k * dpr) / dpr;
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 8;
      ty = (e.clientY / window.innerHeight - 0.5) * 8;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    let t0: number | null = null;
    let raf = 0;
    const frame = (ts: number) => {
      if (t0 === null) t0 = ts;
      const t = reduce ? 99 : (ts - t0) / 1000;
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      field.forEach((s) => {
        const a = 0.18 + 0.18 * Math.sin(t * 0.7 + s.tw);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(X(s.x - mx * 0.5), Y(s.y - my * 0.5), s.r * k, 0, 6.283);
        ctx.fill();
      });
      pts.forEach((p) => {
        const e2 = ease(clamp((t - 0.2 - p.delay) / 1.7));
        p.x = p.sx + (p.tx - p.sx) * e2 + mx;
        p.y = p.sy + (p.ty - p.sy) * e2 + my;
      });
      const la = clamp((t - 1.6) / 0.9);
      if (la > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${(0.42 * la).toFixed(3)})`;
        ctx.beginPath();
        links.forEach(([a, b]) => {
          ctx.moveTo(X(pts[a].x), Y(pts[a].y));
          ctx.lineTo(X(pts[b].x), Y(pts[b].y));
        });
        ctx.stroke();
      }
      const oa = clamp((t - 2.2) / 1.4);
      if (oa > 0) {
        const S = k * SC;
        ctx.save();
        ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * k * (OX + 600 * PAD + mx), dpr * k * (OY + 600 * PAD + my));
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 1.25 / S;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        shapes.forEach((s) => {
          if (!s.path) return;
          ctx.setLineDash([s.len, s.len]);
          ctx.lineDashOffset = s.len * (1 - ease(oa));
          ctx.stroke(s.path);
          if (s.closed) {
            ctx.fillStyle = `rgba(255,255,255,${(0.07 * oa).toFixed(3)})`;
            ctx.fill(s.path);
          }
        });
        ctx.setLineDash([]);
        ctx.restore();
      }
      pts.forEach((p) => {
        const tw = 0.82 + 0.18 * Math.sin(t * 1.6 + p.tw);
        const r = p.big ? 2.8 : p.end ? 2 : 1.45;
        ctx.fillStyle = `rgba(255,255,255,${tw.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y), r, 0, 6.283);
        ctx.fill();
        if (p.big) {
          ctx.strokeStyle = `rgba(255,255,255,${(0.25 * tw).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), r + 3.5, 0, 6.283);
          ctx.stroke();
        }
      });
      if (runner?.el && t > 3.6) {
        const u = ((t - 3.6) / 5) % 1;
        const q = runner.el.getPointAtLength(runner.len * u);
        const rx = X(OX + q.x * SC + mx);
        const ry = Y(OY + q.y * SC + my);
        const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, 12);
        g.addColorStop(0, "rgba(107,194,251,0.55)");
        g.addColorStop(1, "rgba(107,194,251,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(rx, ry, 12, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = "#6BC2FB";
        ctx.beginPath();
        ctx.arc(rx, ry, 2.4, 0, 6.283);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    size();
    const onResize = () => {
      size();
      if (reduce) requestAnimationFrame(frame);
    };
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={host} className="relative aspect-square w-[min(72vw,25rem)]" aria-hidden>
      <svg ref={src} width="0" height="0" viewBox="0 0 100 100" className="absolute size-0 overflow-hidden">
        {SHAPES.map((sh, i) =>
          sh.k === "dot" ? <circle key={i} data-k="dot" cx={sh.cx} cy={sh.cy} r={sh.r} /> : <path key={i} data-k={sh.k} d={sh.d} />,
        )}
      </svg>
      {/* Orbit rings and the four seats, as on the website */}
      <svg viewBox="0 0 600 600" className="absolute inset-0 size-full overflow-visible">
        <circle cx="300" cy="290" r="130" fill="url(#sp-glow)" />
        <defs>
          <radialGradient id="sp-glow">
            <stop offset="0" stopColor="#6BC2FB" stopOpacity=".2" />
            <stop offset="1" stopColor="#6BC2FB" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="300" cy="300" r="150" fill="none" stroke="rgba(255,255,255,.10)" />
        <circle cx="300" cy="300" r="222" fill="none" stroke="rgba(255,255,255,.22)" strokeDasharray="2 10" />
        
        {(
          [
            [300, 50, "Client"],
            [70, 404, "Planner"],
            [530, 404, "CPA"],
            [300, 556, "Attorney"],
          ] as const
        ).map(([x, y, l], i) => (
          <g key={l} className="rise" style={{ animationDelay: `${1.2 + i * 0.12}s` }}>
            <circle cx={x} cy={y} r="3.5" fill="#fff" />
            <text x={x} y={y + 34} textAnchor="middle" fill="rgba(255,255,255,.62)" style={{ font: "500 17px var(--font-sans-brand)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {l}
            </text>
          </g>
        ))}
      </svg>
      <canvas ref={canvas} className="absolute -inset-[12%] h-[124%] w-[124%]" />
    </div>
  );
}

export function Splash({ onEnter }: { onEnter: (seat: Role | null, tour: boolean) => void }) {
  const [leaving, setLeaving] = useState(false);
  const go = (seat: Role | null, tour: boolean) => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onEnter(seat, tour), 650);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") go("planner", false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div
      className={`ink fixed inset-0 z-[90] flex flex-col overflow-hidden px-6 text-white sm:px-10 ${leaving ? "splash-out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_40%,rgba(107,194,251,0.10),transparent_70%)]" aria-hidden />
      <header className="relative flex items-center justify-between py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/catasto-logo-white.svg" alt="Catasto" className="h-6 w-auto" />
        <span className="eyebrow text-white/45">V1.1 demo</span>
      </header>
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <Constellation />
        <div className="mt-2 max-w-2xl text-center">
          <h1 id="splash-title" className="rise font-display text-[clamp(2.4rem,5.4vw,3.8rem)] leading-[1] tracking-[-0.015em]" style={{ animationDelay: "1.5s" }}>
            One client record for the whole planning team.
          </h1>
          <div className="rise mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "1.75s" }}>
            <button
              autoFocus
              onClick={() => go("planner", false)}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 font-medium text-black transition-colors hover:bg-[#e9e9e7]"
            >
              Enter the demo <ArrowRight className="size-4" aria-hidden />
            </button>
            <button
              onClick={() => go("planner", true)}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/35 px-5 font-medium text-white transition-colors hover:border-white hover:bg-white/10"
            >
              <MapIcon className="size-4" aria-hidden /> Take the guided tour
            </button>
          </div>
        </div>
      </div>
      <footer className="rise relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-5 text-[0.8rem] text-white/50" style={{ animationDelay: "2s" }}>
        <span>File Sharing · Secure Message · Consent Management</span>
        <span>Fictional household. No real client data.</span>
      </footer>
    </div>
  );
}
