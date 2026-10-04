import type { ReactNode } from "react";
import { MessagesShell } from "./MessagesShell";

export const metadata = {
  title: "Messages | BJH Logistics",
  description: "Everything sent to clients, broadcasts and quotes.",
};

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
