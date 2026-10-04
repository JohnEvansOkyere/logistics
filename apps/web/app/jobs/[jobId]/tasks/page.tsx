"use client";

import { JobTasks } from "../../JobTasks";
import { useJob } from "../../JobShell";

export default function JobTasksPage() {
  const { job, isStaff, closedJob } = useJob();
  return isStaff ? <JobTasks canEdit={!closedJob} jobId={job.id} /> : null;
}
