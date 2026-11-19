# Catasto MVP demo (V2)

Front-end demo of the Catasto MVP, built for the backend handoff. One secure record per household for the adviser, the client, the CPA and the estate attorney. The client controls who sees what.

Everything runs in the browser with **fictional data only**. There is no backend yet: state lives in memory and resets on reload. The screens call one API file, `src/lib/core/api.ts`, so the backend can replace it function by function.

Companion documents: *Catasto MVP 1-Pager* and *Catasto MVP Architecture (C4), Draft 2*.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

> Next.js is pinned to 16.4.6, the latest patched 16.x as of Nov 19, 2026. Keep it current.

## Walk the demo

Black and white, with Catasto blue used sparingly: focus rings, switches that are on, count badges, the "You" tag, and a soft glow on anything just added. Buttons press in slightly and give a light tap on phones that support it.

A thin black bar at the top holds the only demo controls: **Part 1: Onboarding**, **Part 2: Daily work**, and a small **view as** switch (Adviser, Client, CPA, Attorney). A one-line hint says what to do next. Click any empty field to fill in a sample value.

**Part 1: Onboarding** (starts empty)

1. Adviser signs in: email and password, then the authenticator code (click the boxes).
2. Adviser creates a household: household name, client name, email, phone.
3. Adviser opens the household, goes to **Team** and invites the Client. A one-use, 7-day link appears.
4. Switch to **Client**: accept the invite, create an account, set up the authenticator.
5. Client signs the **information sharing consent** and chooses: ask me each time, or let my professionals see each other's folders (sweeping consent).
6. Switch to **Adviser**: invite the CPA and the Attorney.
7. Switch to **CPA**, then **Attorney**: each accepts, signs up and sets up MFA.

**Part 2: Daily work** (a whole team already set up)

- Three households. The CPA works with Harper and Okafor and has a new invite to Brennan; the Attorney works with Harper and Brennan. Switch to **CPA** and click **Accept** to join Brennan with the same account.
- Upload sample planning documents (or a real file from your computer, kept in the tab only).
- Create folders in your own workspace and ask to share them.
- Request access to another workspace's folder; switch to **Client** and approve it under **Access**.
- Turn sweeping consent on or off, or tick who sees what.
- Send secure messages, start a direct message or a group chat.

## The rules

- Each of the four roles has its own **workspace**. Only the owner adds files to it. Others can only view.
- **Nobody sees another workspace unless the client allows it**, either folder by folder or with sweeping consent.
- The client sees everything in their household and is the only one who approves, declines or changes access.
- Locked folders are shown, not hidden, with a **Request access** button.
- Nothing is visible to professionals until the client has signed the information sharing consent.
- CPAs and attorneys can work with many households. Their home screen is the household list, and a new invite shows there with one-click **Accept** (no second sign-up). Each household keeps its own consent and access.
- The adviser never controls access, not even to their own workspace. By default it is open to every professional who joins, and only the client can take that away, folder by folder.
- In **Settings** (gear icon, Adviser view), the adviser can switch off "Share my workspace with the team" to lock it to just the adviser and the client. The adviser can lock, never grant.

## The 7 MVP features

| Feature | Where |
|---|---|
| 1. Sign-in with MFA | `components/demo/auth.tsx` (`AdviserSignIn`, `JoinFlow`) |
| 2. Household list and setup | `components/demo/households.tsx` |
| 3. Invite a professional | `components/demo/team.tsx`, `api.invite`, `api.join` |
| 4. Consent | `components/demo/auth.tsx` (`ClientConsent`), `components/demo/access.tsx`, `lib/core/rules.ts` |
| 5. Files | `components/demo/files.tsx` |
| 6. Messages | `components/demo/messages.tsx` |
| 7. Audit log | `Household.audit` in `lib/core/api.ts` (no screen) |

## Folder map

```
src/
  app/                  layout, page, global styles (black and white tokens)
  lib/core/             the "core" from the C4: replace with the backend
    types.ts            data model (memberships, invites, consents, folders, items, audit)
    rules.ts            the consent engine: canView, canUpload, canManageAccess
    api.ts              every action the screens can take
    seed.ts             Part 1 (empty) and Part 2 (full team) starting states
    samples.ts          fictional sample documents
  components/demo/      the screens (the "Catasto module")
  components/ui/        dialog and button primitives (shadcn/ui)
```

See `ARCHITECTURE.md` for how this maps to the C4 and what the backend must do.
