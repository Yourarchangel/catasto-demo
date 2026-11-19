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
| The adviser never grants access. Their workspace opens to each joining professional by default; the client can remove it | `api.join`, `api.createFolder` (adviser grants), `setGrant` |
| The adviser can lock their own workspace (Settings), which overrides any grant | `Household.adviserShares` in `canView`, `api.setAdviserSharing` |
| Locked folders are shown, with a request button, and return no files | `visibleFiles`, `FolderCard` |
| Invites are one use and expire in 7 days | `api.invite`, `api.join` (checks `usedAt`) |
| One CPA or attorney account can belong to many households; consent and access are per household | `api.acceptInvite`, `HouseholdList` |
| Every view, upload, share and consent change is logged, including denials | `log()` and `viewFile()` in `api.ts` |

Note on identity: the demo has one person per role, so `Member.someoneElse` marks the other households' clients. The real build links memberships to a `users` table, so one user can hold many memberships.

Note: per the C4, a joining professional should also wait for the client to confirm them by name before anything opens. In this demo a new professional sees only the adviser's workspace (unless the adviser locked it) until the client grants more. Add the confirm-by-name step on the server.

## API surface to replace

Each function in `src/lib/core/api.ts` becomes one server call. The server checks `rules.ts` first, then writes an audit event.

| Function | Who may call it |
|---|---|
| `createHousehold` | Adviser |
| `invite` | Adviser |
| `join` | Holder of a valid, unused invite |
| `acceptInvite` | A signed-in user with a valid invite to another household (reuses their account) |
| `signConsent`, `setSweeping`, `setGrant`, `decide` | Client |
| `requestAccess` | Any joined professional |
| `createFolder`, `upload` | Owner of the workspace (the adviser cannot choose who sees a new folder) |
| `setAdviserSharing` | Adviser (can only lock or reopen their own workspace) |
| `viewFile` | Anyone `canView` allows (issues the 5-minute link) |
| `openThread`, `send` | Joined members of the thread |

## Not in this demo

Real sign-in, persistence, email or SMS, notifications, tasks, e-signature, AI, integrations, deleting anything.
