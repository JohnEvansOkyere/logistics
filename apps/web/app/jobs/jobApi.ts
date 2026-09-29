import type {
  DocumentType,
  JobStatus,
  MilestoneDefinition,
  PartyRole,
  ReferenceKind,
  ServiceLine,
  StaffRoleKey,
  TaskKind,
} from "@bjh/contracts";
import { authenticatedFetch } from "../auth/authenticatedFetch";

export type Job = {
  id: string;
  fileNumber: string;
  serviceLine: ServiceLine;
  customerCompanyId: string;
  customerCompanyName: string;
  quoteRequestId: string | null;
  status: JobStatus;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
};

export type MilestoneEvent = {
  id: string;
  milestoneKey: string;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
  note: string | null;
  correctionOf: string | null;
};

export type Timeline = {
  job: Job;
  template: MilestoneDefinition[];
  events: MilestoneEvent[];
};

export type StatusHistory = {
  job: Job;
  allowedNext: JobStatus[];
  history: Array<{
    id: string;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    reason: string | null;
    changedBy: string;
    changedAt: string;
  }>;
};

export type Party = {
  id: string;
  role: PartyRole;
  name: string;
  details: string | null;
};

export type Reference = {
  id: string;
  kind: ReferenceKind;
  value: string;
  sealNumber: string | null;
  parentReferenceId: string | null;
};

export const serviceLineLabels: Record<ServiceLine, string> = {
  sea_import: "Sea import",
  sea_export: "Sea export",
  air_import: "Air import",
  air_export: "Air export",
};

export const statusLabels: Record<JobStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  on_hold: "On hold",
  ready_to_close: "Ready to close",
  closed: "Closed",
  cancelled: "Cancelled",
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";
const jobsUrl = `${apiBaseUrl.replace(/\/$/, "")}/v1/jobs`;

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(message ?? "The request could not be completed");
  }
  return (await response.json()) as T;
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return authenticatedFetch(`${jobsUrl}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((response) => readResponse<T>(response));
}

export const listJobs = (search: string) =>
  send<Job[]>(`?${new URLSearchParams({ search })}`, "GET");
export const createJob = (input: {
  customerCompanyId: string;
  serviceLine: ServiceLine;
}) => send<Job>("", "POST", input);
export const getTimeline = (id: string) =>
  send<Timeline>(`/${encodeURIComponent(id)}/milestones`, "GET");
export const recordMilestone = (
  id: string,
  input: { milestoneKey: string; occurredAt?: string; note?: string },
) =>
  send<MilestoneEvent>(`/${encodeURIComponent(id)}/milestones`, "POST", input);
export const getStatusHistory = (id: string) =>
  send<StatusHistory>(`/${encodeURIComponent(id)}/status-history`, "GET");
export const changeStatus = (
  id: string,
  input: { status: JobStatus; reason?: string },
) => send<Job>(`/${encodeURIComponent(id)}/status`, "POST", input);
export const listParties = (id: string) =>
  send<Party[]>(`/${encodeURIComponent(id)}/parties`, "GET");
export const addParty = (
  id: string,
  input: { role: PartyRole; name: string; details?: string },
) => send<Party>(`/${encodeURIComponent(id)}/parties`, "POST", input);
export const removeParty = (id: string, partyId: string) =>
  send<unknown>(
    `/${encodeURIComponent(id)}/parties/${encodeURIComponent(partyId)}`,
    "DELETE",
  );
export const listReferences = (id: string) =>
  send<Reference[]>(`/${encodeURIComponent(id)}/references`, "GET");
export const addReference = (
  id: string,
  input: {
    kind: ReferenceKind;
    value: string;
    sealNumber?: string;
    parentReferenceId?: string;
  },
) => send<Reference>(`/${encodeURIComponent(id)}/references`, "POST", input);
export const removeReference = (id: string, referenceId: string) =>
  send<unknown>(
    `/${encodeURIComponent(id)}/references/${encodeURIComponent(referenceId)}`,
    "DELETE",
  );

export type JobDocument = {
  id: string;
  documentType: DocumentType;
  createdAt: string;
  versions: Array<{
    versionNumber: number;
    filename: string;
    contentType: string;
    sizeBytes: number;
    uploadedAt: string;
  }>;
};

export type DownloadLink = {
  url: string;
  expiresInSeconds: number;
  filename: string;
};

export const listDocuments = (id: string) =>
  send<JobDocument[]>(`/${encodeURIComponent(id)}/documents`, "GET");

export async function uploadDocument(
  id: string,
  input: { file: File; documentType: DocumentType; documentId?: string },
): Promise<JobDocument> {
  const form = new FormData();
  form.append("documentType", input.documentType);
  if (input.documentId) form.append("documentId", input.documentId);
  form.append("file", input.file);
  // No content-type header: the browser adds the multipart boundary.
  return readResponse<JobDocument>(
    await authenticatedFetch(`${jobsUrl}/${encodeURIComponent(id)}/documents`, {
      method: "POST",
      body: form,
    }),
  );
}

export const getDownloadLink = (
  id: string,
  documentId: string,
  versionNumber: number,
) =>
  send<DownloadLink>(
    `/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download?version=${versionNumber}`,
    "GET",
  );

export type EtaEvent = {
  id: string;
  etaAt: string;
  source: string;
  note: string | null;
  recordedAt: string;
  recordedBy: string;
  correctionOf: string | null;
};

export type Eta = { current: EtaEvent | null; history: EtaEvent[] };

export const getEta = (id: string) =>
  send<Eta>(`/${encodeURIComponent(id)}/eta`, "GET");
export const recordEta = (
  id: string,
  input: {
    etaAt: string;
    source: string;
    note?: string;
    correctionOf?: string;
  },
) => send<EtaEvent>(`/${encodeURIComponent(id)}/eta`, "POST", input);

export type JobTask = {
  id: string;
  jobId: string;
  fileNumber: string;
  customerCompanyName: string;
  kind: TaskKind;
  title: string;
  details: string | null;
  assignedRole: StaffRoleKey;
  dueDate: string | null;
  status: "open" | "done";
  completedAt: string | null;
  completionNote: string | null;
};

export const taskKindLabels: Record<TaskKind, string> = {
  task: "Task",
  missing_documents: "Missing documents",
  damage: "Damage",
  delay: "Delay",
  other: "Other",
};

export const roleLabels: Record<StaffRoleKey, string> = {
  super_admin: "Super admin",
  sea_import_rep: "Sea import",
  sea_export_rep: "Sea export",
  air_import_rep: "Air import",
  air_export_rep: "Air export",
};

export const listJobTasks = (id: string) =>
  send<JobTask[]>(`/${encodeURIComponent(id)}/tasks`, "GET");
export const createJobTask = (
  id: string,
  input: {
    kind: TaskKind;
    title: string;
    details?: string;
    assignedRole: StaffRoleKey;
    dueDate?: string;
  },
) => send<JobTask>(`/${encodeURIComponent(id)}/tasks`, "POST", input);
export const completeJobTask = (id: string, taskId: string, note?: string) =>
  send<JobTask>(
    `/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}/complete`,
    "POST",
    { note },
  );
export const listTasks = (assignedRole: string, status: "open" | "all") =>
  authenticatedFetch(
    `${apiBaseUrl.replace(/\/$/, "")}/v1/tasks?${new URLSearchParams({
      ...(assignedRole ? { assignedRole } : {}),
      status,
    })}`,
  ).then((response) => readResponse<JobTask[]>(response));
