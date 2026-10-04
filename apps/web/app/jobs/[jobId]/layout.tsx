import type { ReactNode } from "react";
import { JobShell } from "../JobShell";

export const metadata = { title: "Job | BJH Logistics" };

export default async function JobLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobShell jobId={jobId}>{children}</JobShell>;
}
