"use client";
import { useEffect, useState } from "react";
import { Splash } from "./splash";
import { UiProvider, useUi } from "./ui-state";
import { DemoBar, DEMO_H } from "./demo-bar";
import { ClientShell, ProShell, SignInGate } from "./shell";
import { Tour } from "./tour";
import { HomeView } from "./views/home";
import { FilesView } from "./views/files";
import { MessagesView } from "./views/messages";
import { ConsentView } from "./views/consent";
import { ActivityView } from "./views/activity";
import { useHousehold } from "@/lib/demo/store";

function Screen() {
  const { ui } = useUi();
  switch (ui.view) {
    case "files":
      return <FilesView />;
    case "messages":
      return <MessagesView />;
    case "consent":
      return <ConsentView />;
    case "activity":
      return <ActivityView />;
    default:
      return <HomeView />;
  }
}

function Frame() {
  const s = useHousehold();
  const { ui, set, me } = useUi();
  const [film] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("film");
    } catch {
      return false;
    }
  });
  const [intro, setIntro] = useState(() => {
    try {
      return window.sessionStorage.getItem("catasto-v11-intro") !== "seen";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const on = () => setIntro(true);
    window.addEventListener("catasto:intro", on);
    return () => window.removeEventListener("catasto:intro", on);
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [ui.view, ui.seat]);
  const h = film ? 0 : DEMO_H;
  const signedIn = s.signedIn.includes(me);
  const content = (
    <div key={`${me}-${ui.view}-${signedIn}`} className={ui.seat === "client" && ui.view === "messages" && ui.convId ? "view-in h-full" : "view-in"}>
      <Screen />
    </div>
  );
  return (
    <div style={{ ["--demo-h" as string]: `${h}px`, paddingTop: h }} className="min-h-screen">
      {!film && <DemoBar />}
      {ui.seat === "client" ? (
        <ClientShell signedIn={signedIn}>
          <SignInGate>{content}</SignInGate>
        </ClientShell>
      ) : signedIn ? (
        <ProShell>{content}</ProShell>
      ) : (
        <SignInGate>{content}</SignInGate>
      )}
      {!intro && !film && <Tour />}
      {intro && (
        <Splash
          onEnter={(seat, tour) => {
            try {
              window.sessionStorage.setItem("catasto-v11-intro", "seen");
            } catch {
              /* ignore */
            }
            setIntro(false);
            set({ seat: seat ?? "planner", view: "home", tour: tour ? 0 : null, tourDismissed: true });
          }}
        />
      )}
    </div>
  );
}

export default function DemoApp() {
  return (
    <UiProvider>
      <Frame />
    </UiProvider>
  );
}
