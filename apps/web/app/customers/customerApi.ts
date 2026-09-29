import type { CustomerInput } from "@bjh/contracts";
import { authenticatedFetch } from "../auth/authenticatedFetch";

export type CustomerContact = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type CustomerCompany = {
  id: string;
  companyName: string;
  createdAt: string;
  contacts: CustomerContact[];
};

export type NewCustomer = CustomerInput;

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
