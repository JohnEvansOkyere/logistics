import { authenticatedFetch } from "../auth/authenticatedFetch";

export type CustomerContact = {
  id: string;
  name: string;
  email: string;
  /** For SMS messages. */
  phone: string | null;
  /** Whether this person receives customer messages. */
  notify: boolean;
  createdAt: string;
};

export type CustomerCompany = {
  id: string;
  companyName: string;
  createdAt: string;
  contacts: CustomerContact[];
};

export type NewCustomer = {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001/api";
const customersUrl = `${apiBaseUrl.replace(/\/$/, "")}/v1/customers`;

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

export async function listCustomers(
  search: string,
): Promise<CustomerCompany[]> {
  const query = new URLSearchParams({ search });
  return readResponse<CustomerCompany[]>(
    await authenticatedFetch(`${customersUrl}?${query}`),
  );
}

export async function getCustomer(id: string): Promise<CustomerCompany> {
  return readResponse<CustomerCompany>(
    await authenticatedFetch(`${customersUrl}/${encodeURIComponent(id)}`),
  );
}

export async function createCustomer(
  customer: NewCustomer,
): Promise<CustomerCompany> {
  return readResponse<CustomerCompany>(
    await authenticatedFetch(customersUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(customer),
    }),
  );
}

export async function addContact(
  companyId: string,
  contact: { name: string; email: string; phone?: string },
): Promise<CustomerContact> {
  return readResponse<CustomerContact>(
    await authenticatedFetch(
      `${customersUrl}/${encodeURIComponent(companyId)}/contacts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contact),
      },
    ),
  );
}

export async function updateContact(
  companyId: string,
  contactId: string,
  update: { phone: string; notify: boolean },
): Promise<CustomerContact> {
  return readResponse<CustomerContact>(
    await authenticatedFetch(
      `${customersUrl}/${encodeURIComponent(companyId)}/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      },
    ),
  );
}
