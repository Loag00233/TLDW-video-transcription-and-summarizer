"use client";

import DebugPanel from "./DebugPanel";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DebugPanel />
    </>
  );
}
