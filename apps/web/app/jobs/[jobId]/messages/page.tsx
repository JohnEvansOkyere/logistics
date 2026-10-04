"use client";

import { JobCorrespondence } from "../../JobCorrespondence";
import { JobMessages } from "../../JobMessages";
import { useJob } from "../../JobShell";

export default function JobMessagesPage() {
  const { job, documents, isStaff } = useJob();
  if (!isStaff) return null;
  return (
    <>
      <JobMessages jobId={job.id} />
      <JobCorrespondence documents={documents} jobId={job.id} />
    </>
  );
}
