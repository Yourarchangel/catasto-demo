@AGENTS.md

# Catasto platform

Catasto gives a household's adviser, client, CPA and estate attorney one shared record. The client controls who sees what. This repo is the MVP front-end demo (V2): fictional data, in-memory state, no backend. Read README.md and ARCHITECTURE.md first.

## Stack

- Next.js (App Router, TypeScript, `src/` directory)
- Tailwind CSS v4. Tokens live in `src/app/globals.css`. Black and white, with Catasto blue (`bg-brand`, `border-brand`, `bg-brand-soft`) only as a sparing accent. Use token classes, never hex values.
- shadcn/ui primitives in `src/components/ui/` (dialog, button).
- All rules live in `src/lib/core/rules.ts`; all actions in `src/lib/core/api.ts`. Screens never change state directly.
- Lucide icons via `lucide-react`. Use Lucide only, no other icon sets.

## Design rules

- Brutally simple: black and white, a few touches of blue (focus, on, counts, "You", new items), no other decoration. Instrument Serif for page titles, Instrument Sans for everything else.
- Show roles (Adviser, Client, CPA, Attorney), not names, in permission screens.
- The brand voice is calm, precise and plain, like a trusted advisor. Sentence case. No hype words.
- No em dashes in UI copy or docs.
- Client data security is a precondition. Never put real client data in the repo, seeds or screenshots.

## Commands

- `npm run dev` starts the dev server at http://localhost:3000
- `npm run build` checks that everything compiles
- `npm run lint` runs ESLint
