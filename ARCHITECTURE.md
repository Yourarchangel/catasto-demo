# Architecture notes for the backend

This demo is the **browser app** and **Catasto module** from the MVP C4 (Draft 2). `src/lib/core` stands in for the **core services**. Replace it with the server, keeping the same shapes so the screens barely change.

## C4 mapping

| C4 part | In this repo | In the real build |
|---|---|---|
| Browser app | `src/app`, `src/components/demo` | Same code. Calls the server instead of `api.ts`. |
| Server app: Catasto module | `src/components/demo` actions | Server actions or route handlers per screen |
| Core: Identity | `AdviserSignIn`, `JoinFlow` (simulated) | Managed provider with MFA required |
| Core: Households + members | `Household`, `Member` | `households`, `memberships` tables |
| Core: Invites | `api.invite`, `api.join` | `invites` table: token hash, role, 7-day expiry, one use |
| Core: Consent engine | `lib/core/rules.ts` | Same rules on the server, plus row-level security |
| Core: Items | `Folder`, `FileItem`, `Thread`, `Message` | `folders`, `items`, `item_shares` |
| Core: Audit log | `Household.audit` | `audit_events`, insert only |
| File storage | blob URLs in memory | Private encrypted bucket, 5-minute signed links |

## Consent rules as implemented

| Rule | Code |
|---|---|
| Nothing outside your own workspace until the client signs consent | `consentSigned` in `canView` |
| The client sees everything and is the only approver | `canView` (client), `canManageAccess` |
| Professionals see another workspace's folder only if granted, or if sweeping consent is on | `canView`: `f.grants`, `consent.sweeping` |
| Only the owner adds files to a folder | `canUpload` |
| Locked folders are shown, with a request button, and return no files | `visibleFiles`, `FolderCard` |
| Invites are one use and expire in 7 days | `api.invite`, `api.join` (checks `usedAt`) |
| Every view, upload, share and consent change is logged, including denials | `log()` and `viewFile()` in `api.ts` |

Note: per the C4, a joining professional should also wait for the client to confirm them by name before anything opens. In this demo that confirmation is covered by folder approval, since a new professional starts with no access.

## API surface to replace

Each function in `src/lib/core/api.ts` becomes one server call. The server checks `rules.ts` first, then writes an audit event.

| Function | Who may call it |
|---|---|
| `createHousehold` | Adviser |
| `invite` | Adviser |
| `join` | Holder of a valid, unused invite |
| `signConsent`, `setSweeping`, `setGrant`, `decide` | Client |
| `requestAccess` | Any joined professional |
| `createFolder`, `upload` | Owner of the workspace |
| `viewFile` | Anyone `canView` allows (issues the 5-minute link) |
| `openThread`, `send` | Joined members of the thread |

## Not in this demo

Real sign-in, persistence, email or SMS, notifications, tasks, e-signature, AI, integrations, deleting anything.
