"use client";

import { JobDeliveries } from "../../JobDeliveries";
import { JobStock } from "../../JobStock";
import { useJob } from "../../JobShell";

export default function JobDeliveryPage() {
  const { job, documents, isStaff, closedJob } = useJob();
  return (
    <>
      <JobDeliveries
        canEdit={isStaff && !closedJob}
        documents={documents}
        jobId={job.id}
      />
      {job.serviceLine === "warehousing" && (
        <JobStock canEdit={isStaff && !closedJob} jobId={job.id} />
      )}
    </>
  );
}
