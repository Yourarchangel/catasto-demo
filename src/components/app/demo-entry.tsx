"use client";
// The demo keeps its state in the browser, so it renders on the client only.
import dynamic from "next/dynamic";

const DemoApp = dynamic(() => import("./demo-app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground" role="status">
      Opening the Harper household
    </div>
  ),
});

export function DemoEntry() {
  return <DemoApp />;
}
