import type { ReactNode } from "react";
import { useScrolled } from "../lib/useScrolled";

export default function AppTopbar({ children }: { children: ReactNode }) {
  const scrolled = useScrolled(12);
  return (
    <header className={`app-topbar${scrolled ? " scrolled" : ""}`}>
      {children}
    </header>
  );
}
