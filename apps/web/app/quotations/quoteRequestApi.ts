export type QuoteRequest = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  message: string;
  createdAt: string;
  customerCompanyId: string | null;
  customerCompanyName: string | null;
};

export type NewQuoteRequest = Omit<
  QuoteRequest,
  "id" | "createdAt" | "customerCompanyId" | "customerCompanyName"
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
    await fetch(`${quoteRequestsUrl}${queryString}`),
  );
}

export async function getQuoteRequest(id: string): Promise<QuoteRequest> {
  return readResponse<QuoteRequest>(
    await fetch(`${quoteRequestsUrl}/${encodeURIComponent(id)}`),
  );
}

export async function createQuoteRequest(
  request: NewQuoteRequest,
): Promise<QuoteRequest> {
  return readResponse<QuoteRequest>(
    await fetch(quoteRequestsUrl, {
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
    await fetch(
      `${quoteRequestsUrl}/${encodeURIComponent(requestId)}/customer`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerCompanyId }),
      },
    ),
  );
}
