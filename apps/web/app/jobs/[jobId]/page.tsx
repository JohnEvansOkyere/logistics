import { JobDetail } from "../JobDetail";

export const metadata = { title: "Job | BJH Logistics" };

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobDetail jobId={jobId} />;
}
