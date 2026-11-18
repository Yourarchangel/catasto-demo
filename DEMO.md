# Catasto V1.1 demo

The MVP only: File Sharing, Secure Message and Consent Management, plus secure sign-in, notifications and an activity log. The fictional Harper household. No real data. Everything runs in the browser.

## Run it

On Windows, double-click **Start Catasto demo.bat** in this folder. The first time, it installs the demo (a minute or two). Keep the black window open while you use it.

Or from a terminal: `npm install`, then `npm run dev`, then open http://localhost:3000.

## The five-step flow

The demo starts from zero. Take the tour, or click through it yourself:

1. **Planner adds a household.** Elena signs in (magic link plus code) and invites the Harpers. She sees nothing yet.
2. **Client approves the planner.** Priya signs in on her phone and approves Elena (Reg S-P).
3. **Client invites the CPA and attorney.** Priya picks Tax for Gary and Estate for Rebecca. Each gets their own app.
4. **CPA shares the return, clients sign 7216.** Gary uploads into Tax. It is held from Elena until Priya and Daniel both sign (IRC 7216).
5. **The team works in one place.** Elena sees the return and messages the team with it attached.

## Consent rules built in

- **Reg S-P:** a professional sees nothing until the clients approve them.
- **IRC 7216:** a CPA's upload to Tax is held from the other professionals until both spouses sign.
- **ABA Rule 1.6:** the attorney's files are private. Sharing one shows a privilege warning and needs client approval.
- The clients can change folders or remove anyone at any time. Access ends immediately.
- Anything held or blocked shows the rule in one line.

## Demo bar

Seats 1 to 4, Simulate a reply, Intro, Take the tour, Phone frame, and Reset demo (start the five-step flow, or load a working household to explore). Add `?film` to the address to hide the bar for recordings.

## Where things live

- `src/lib/demo/`: data model, seed, consent rules (`rules.ts`), store, simulator
- `src/components/app/`: shell, sign-in, demo bar, tour
- `src/components/app/views/`: Home, Files, Messages, Consent, Activity
