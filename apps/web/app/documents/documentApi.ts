import { authenticatedFetch } from "../auth/authenticatedFetch";
import type { DocumentType } from "@bjh/contracts";

export type LibraryDocument = {
  id: string;
  jobId: string | null;
  fileNumber: string | null;
  companyId: string | null;
  companyName: string | null;
  title: string | null;
  documentType: DocumentType;
  createdAt: string;
  versionCount: number;
  latest: {
    versionNumber: number;
    filename: string;
    sizeBytes: number;
    uploadedAt: string;
  };
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";
const documentsUrl = `${apiBaseUrl.replace(/\/$/, "")}/v1/documents`;

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

export async function searchDocuments(
  search: string,
  type: DocumentType | "",
): Promise<LibraryDocument[]> {
  const query = new URLSearchParams({ search });
  if (type) query.set("type", type);
  return readResponse<LibraryDocument[]>(
    await authenticatedFetch(`${documentsUrl}?${query}`),
  );
}

export async function uploadLibraryDocument(input: {
  file: File;
  documentType: DocumentType;
  title: string;
  jobId?: string;
  companyId?: string;
}): Promise<LibraryDocument> {
  const form = new FormData();
  form.append("documentType", input.documentType);
  if (input.title.trim()) form.append("title", input.title.trim());
  if (input.jobId) form.append("jobId", input.jobId);
  if (input.companyId) form.append("companyId", input.companyId);
  form.append("file", input.file);
  // No content-type header: the browser adds the multipart boundary.
  return readResponse<LibraryDocument>(
    await authenticatedFetch(documentsUrl, { method: "POST", body: form }),
  );
}

export async function getLibraryDownloadLink(
  documentId: string,
  versionNumber: number,
): Promise<{ url: string }> {
  return readResponse<{ url: string }>(
    await authenticatedFetch(
      `${documentsUrl}/${encodeURIComponent(documentId)}/download?version=${versionNumber}`,
    ),
  );
}
