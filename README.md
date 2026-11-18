# Catasto demo (V1.1)

Catasto gives a client's planning team (financial planner, CPA, estate attorney and the client) one shared, client-authorized record. This repo is the clickable MVP demo used for the SMU Hilltop pitch. It runs entirely in the browser on a fictional household (the Harpers). There is no back end yet.

**Every name, number and document in this repo is invented. No real client data.**

## What it does

Three core features, plus three supports:

| Feature | What it does |
| --- | --- |
| File Sharing | Folders per household (Tax, Estate, Insurance, Investments). Upload, view, download. Every file shows who can see it. |
| Secure Message | A team thread plus direct messages. Text and file attachments. |
| Consent Management | The client approves every person and every folder, and can revoke access at any time. |
| Sign-in | Magic link plus a one-time code (simulated). |
| Notifications | "You have something waiting." Never any client details. |
| Activity log | Who uploaded, viewed, shared, approved or removed what, and when. |

There are four apps on one code base: planner, CPA and attorney (desktop), and client (phone first). A demo bar at the top switches between them and can simulate the other side's replies.

## Consent rules built into the code

All of these live in `src/lib/demo/rules.ts` and `src/lib/demo/store.ts`:

- **Reg S-P (SEC):** a professional sees nothing in a household until the clients approve them.
- **IRC 7216 (IRS):** when the CPA uploads to the Tax folder, the file is held from the other professionals until both spouses sign a 7216 consent.
- **ABA Model Rule 1.6:** attorney files are private by default. Sharing one shows a privilege warning and needs client approval.
- Removing a person or a folder ends access immediately. Anything held or blocked shows the rule behind it in one line.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. `npm run build` and `npm run lint` should both pass clean.

Click **Take the guided tour** for the five-step flow: the planner adds a household, the client approves the planner, the client invites the CPA and attorney, the CPA shares the return and the clients sign 7216, and the team messages in one place.

## Stack

- Next.js 16 (App Router, TypeScript), rendered client-side only
- Tailwind CSS v4 with brand tokens in `src/app/globals.css`
- shadcn/ui components (`src/components/ui/`), Lucide icons, sonner toasts
- pdf-lib for generating sample PDFs in the browser
- Self-hosted fonts (Instrument Serif and Instrument Sans)

## Where things live

```
src/lib/demo/
  types.ts      data model (household, members, files, consents, messages, activity)
  seed.ts       the fictional Harper household, two starting states
  rules.ts      who can see what: the consent rules as code
  store.ts      every action: upload, share, approve, revoke, message, sign in
  simulate.ts   plays the other people for the demo
  files.ts      real uploads, kept in the browser's IndexedDB
src/components/app/
  shell.tsx     desktop and phone layouts, sign-in, notifications
  demo-bar.tsx  the demo controls (not part of the product)
  tour.tsx      the five-step guided tour
  splash.tsx    the opening screen
  views/        Home, Files, Messages, Consent, Activity
```

## What is simulated, and what a real version needs

The demo keeps all state in the browser (localStorage and IndexedDB). For a pilot with real households, the main pieces to build are:

1. **Auth:** real magic-link and MFA sign-in, with sessions per role.
2. **Storage:** an encrypted file store and a database for households, members, consents and messages.
3. **Server-side enforcement:** the rules in `rules.ts` need to run on the server, so a client can never fetch a file it is not allowed to see.
4. **Audit log:** an append-only activity log kept on the server.
5. **Notifications:** real email, text and push delivery, still with no client details.
6. **E-signature** for the 7216 consent form.

`rules.ts` and `types.ts` are the best starting point for a back-end design: they define the permission model the server has to enforce.

## Other notes

- `DEMO.md` covers the demo bar, the tour and how to run the pitch.
- `CLAUDE.md` and `AGENTS.md` hold project conventions for AI coding tools.
- Add `?film` to the URL to hide the demo bar for screen recordings.
