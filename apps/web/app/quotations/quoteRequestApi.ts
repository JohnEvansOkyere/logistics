import { authenticatedFetch } from "../auth/authenticatedFetch";

export type QuoteRequest = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  message: string;
  createdAt: string;
  customerCompanyId: string | null;
  customerCompanyName: string | null;
  quoteDraftRevisionCount: number;
  quoteDraftUpdatedAt: string | null;
};

export type QuoteDraftRevision = {
  id: string;
  revisionNumber: number;
  content: string;
  createdAt: string;
  savedBy: string | null;
};

export type QuoteDraft = {
  id: string;
  requestId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  revisions: QuoteDraftRevision[];
};

export type NewQuoteRequest = Omit<
  QuoteRequest,
  | "id"
  | "createdAt"
  | "customerCompanyId"
  | "customerCompanyName"
  | "quoteDraftRevisionCount"
  | "quoteDraftUpdatedAt"
>;

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";
const quoteRequestsUrl = `${apiBaseUrl.replace(/\/$/, "")}/v1/quote-requests`;

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

export async function listQuoteRequests(
  customerCompanyId?: string,
): Promise<QuoteRequest[]> {
  const query = new URLSearchParams();
  if (customerCompanyId) {
    query.set("customerCompanyId", customerCompanyId);
  }
  const queryString = query.size > 0 ? `?${query}` : "";
  return readResponse<QuoteRequest[]>(
    await authenticatedFetch(`${quoteRequestsUrl}${queryString}`),
  );
}

export async function getQuoteRequest(id: string): Promise<QuoteRequest> {
  return readResponse<QuoteRequest>(
    await authenticatedFetch(`${quoteRequestsUrl}/${encodeURIComponent(id)}`),
  );
}

export async function createQuoteRequest(
  request: NewQuoteRequest,
): Promise<QuoteRequest> {
  return readResponse<QuoteRequest>(
    await authenticatedFetch(quoteRequestsUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
}

export async function associateQuoteRequestCustomer(
  requestId: string,
  customerCompanyId: string,
): Promise<QuoteRequest> {
  return readResponse<QuoteRequest>(
    await authenticatedFetch(
      `${quoteRequestsUrl}/${encodeURIComponent(requestId)}/customer`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerCompanyId }),
      },
    ),
  );
}

export async function getQuoteDraft(
  requestId: string,
): Promise<QuoteDraft | null> {
  const response = await readResponse<{ draft: QuoteDraft | null }>(
    await authenticatedFetch(
      `${quoteRequestsUrl}/${encodeURIComponent(requestId)}/draft`,
    ),
  );
  return response.draft;
}

export async function saveQuoteDraft(
  requestId: string,
  content: string,
): Promise<QuoteDraft> {
  return readResponse<QuoteDraft>(
    await authenticatedFetch(
      `${quoteRequestsUrl}/${encodeURIComponent(requestId)}/draft`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      },
    ),
  );
}
