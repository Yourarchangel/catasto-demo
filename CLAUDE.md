@AGENTS.md

# Catasto platform

Catasto gives a client's whole professional team (financial planner, CPA, estate attorney, insurance agent) one shared record and workspace. Primary users are independent financial planners. Secondary users are the outside specialists they work with.

## Stack

- Next.js (App Router, TypeScript, `src/` directory)
- Tailwind CSS v4. Brand tokens live in `src/app/globals.css`. Never hard-code colors in components; use the token classes (`bg-primary`, `text-muted-foreground`, etc.).
- shadcn/ui components in `src/components/ui/`. Add more with `npx shadcn@latest add <name>`. Edit the copies freely; they are ours.
- Lucide icons via `lucide-react`. Use Lucide only, no other icon sets.
- Toasts via `sonner` (`<Toaster />` is already in the root layout).

## Design rules

- Before building any new screen or page, read `design/frontend-design/SKILL.md` (Anthropic's frontend-design skill) and follow it.
- Brand tokens are placeholders until the Catasto design system is final. When it is, update `globals.css` and the font variables in `src/app/layout.tsx` first, then build screens.
- The brand voice is calm, precise and plain, like a trusted advisor. Sentence case. No hype words.
- No em dashes in UI copy or docs.
- Client data security is a precondition. Never put real client data in the repo, seeds or screenshots.

## Commands

- `npm run dev` starts the dev server at http://localhost:3000
- `npm run build` checks that everything compiles
- `npm run lint` runs ESLint
