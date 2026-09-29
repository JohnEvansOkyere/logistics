import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { createTestApplication, staffFetch } from "./test-application";
import { beginTestDatabase, endTestDatabase } from "./postgres-test-database";

let baseUrl: string;
let application: INestApplication;

async function startApplication(): Promise<void> {
  const started = await createTestApplication();
  application = started.application;
  baseUrl = started.baseUrl;
}

before(async () => {
  await beginTestDatabase();
  await startApplication();
});

after(async () => {
  await application?.close();
  await endTestDatabase();
});

test("a quote request is saved and returned by list and detail endpoints", async () => {
  const response = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "  Example Demo Ltd  ",
      contactName: "  Alex Demo  ",
      email: "alex@example.test",
      message: "  Please contact me about a fictional shipment.  ",
    }),
  });

  assert.equal(response.status, 201, await response.clone().text());
  const created = (await response.json()) as {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    message: string;
    createdAt: string;
  };
  assert.match(created.id, /^[0-9a-f-]{36}$/i);
  assert.equal(created.companyName, "Example Demo Ltd");
  assert.equal(created.contactName, "Alex Demo");
  assert.equal(created.email, "alex@example.test");
  assert.equal(
    created.message,
    "Please contact me about a fictional shipment.",
  );
  assert.ok(Number.isFinite(Date.parse(created.createdAt)));

  const listResponse = await staffFetch(`${baseUrl}/api/v1/quote-requests`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [created]);

  const detailResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${created.id}`,
  );
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), created);
});

test("invalid quote requests are rejected", async () => {
  const invalidRequests = [
    {},
    {
      companyName: "Example Ltd",
      contactName: "Alex Demo",
      email: "not-an-email",
      message: "A request",
    },
    {
      companyName: "Example Ltd",
      contactName: "Alex Demo",
      email: "alex@example.test",
      message: " ",
    },
    {
      companyName: "Example Ltd",
      contactName: "Alex Demo",
      email: "alex@example.test",
      message: "x".repeat(5001),
    },
  ];

  for (const [index, request] of invalidRequests.entries()) {
    const response = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    assert.equal(
      response.status,
      400,
      `case ${index}: ${await response.clone().text()}`,
    );
  }
});

test("quote requests persist when the local API restarts", async () => {
  const response = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Restart Demo Ltd",
      contactName: "Taylor Demo",
      email: "taylor@example.test",
      message: "Persistence check",
    }),
  });
  const created = (await response.json()) as { id: string };

  await application.close();
  await startApplication();

  const readResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${created.id}`,
  );
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).id, created.id);
});

test("unknown quote request IDs return not found", async () => {
  const response = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/unknown-request`,
  );

  assert.equal(response.status, 404);
});

test("staff can explicitly link requests to customers and view request history", async () => {
  const customerResponse = await staffFetch(`${baseUrl}/api/v1/customers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Linked Demo Ltd",
      contactName: "Morgan Demo",
      email: "morgan@example.test",
    }),
  });
  const customer = (await customerResponse.json()) as { id: string };

  const requestResponse = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Linked Demo Ltd",
      contactName: "Morgan Demo",
      email: "morgan@example.test",
      message: "Synthetic linked request",
    }),
  });
  const request = (await requestResponse.json()) as { id: string };

  const linkResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/customer`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerCompanyId: customer.id }),
    },
  );
  assert.equal(linkResponse.status, 200);
  const linked = (await linkResponse.json()) as {
    customerCompanyId: string | null;
    customerCompanyName: string | null;
  };
  assert.equal(linked.customerCompanyId, customer.id);
  assert.equal(linked.customerCompanyName, "Linked Demo Ltd");

  await application.close();
  await startApplication();

  const persistedResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}`,
  );
  const persisted = (await persistedResponse.json()) as {
    customerCompanyId: string | null;
  };
  assert.equal(persisted.customerCompanyId, customer.id);

  const historyResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests?customerCompanyId=${customer.id}`,
  );
  assert.equal(historyResponse.status, 200);
  assert.deepEqual(
    (await historyResponse.json()).map((entry: { id: string }) => entry.id),
    [request.id],
  );
});

test("request association rejects unknown customer companies", async () => {
  const requestResponse = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Unlinked Demo Ltd",
      contactName: "Jordan Demo",
      email: "jordan@example.test",
      message: "Synthetic request",
    }),
  });
  const request = (await requestResponse.json()) as { id: string };

  const linkResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/customer`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerCompanyId: "missing-company" }),
    },
  );

  assert.equal(linkResponse.status, 404);
});

test("quote drafts require an explicitly associated request", async () => {
  const requestResponse = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Draft Gate Demo Ltd",
      contactName: "Casey Demo",
      email: "casey@example.test",
      message: "Synthetic draft gate request",
    }),
  });
  const request = (await requestResponse.json()) as { id: string };

  const getResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/draft`,
  );
  assert.equal(getResponse.status, 409);

  const saveResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/draft`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Synthetic quote draft" }),
    },
  );
  assert.equal(saveResponse.status, 409);
});

test("quote draft edits append immutable revisions and persist in customer history", async () => {
  const customerResponse = await staffFetch(`${baseUrl}/api/v1/customers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Draft History Demo Ltd",
      contactName: "Jamie Demo",
      email: "jamie@example.test",
    }),
  });
  const customer = (await customerResponse.json()) as { id: string };

  const requestResponse = await staffFetch(`${baseUrl}/api/v1/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyName: "Draft History Demo Ltd",
      contactName: "Jamie Demo",
      email: "jamie@example.test",
      message: "Synthetic revision request",
    }),
  });
  const request = (await requestResponse.json()) as { id: string };
  const linkResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/customer`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerCompanyId: customer.id }),
    },
  );
  assert.equal(linkResponse.status, 200);

  const emptyDraftResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/draft`,
  );
  assert.equal(emptyDraftResponse.status, 200);
  assert.deepEqual(await emptyDraftResponse.json(), { draft: null });

  const invalidResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/draft`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "  " }),
    },
  );
  assert.equal(invalidResponse.status, 400);

  const save = (content: string) =>
    staffFetch(`${baseUrl}/api/v1/quote-requests/${request.id}/draft`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
  const firstResponse = await save("Synthetic version one");
  assert.equal(firstResponse.status, 200);
  const first = (await firstResponse.json()) as {
    id: string;
    content: string;
    revisions: Array<{
      id: string;
      revisionNumber: number;
      content: string;
      createdAt: string;
      savedBy: string;
    }>;
  };
  assert.equal(first.revisions.length, 1);
  assert.equal(first.revisions[0].revisionNumber, 1);
  assert.equal(first.revisions[0].content, "Synthetic version one");
  assert.equal(
    first.revisions[0].savedBy,
    "50000000-0000-4000-8000-000000000001",
  );

  const secondResponse = await save("Synthetic revised version two");
  assert.equal(secondResponse.status, 200);
  const second = (await secondResponse.json()) as typeof first;
  assert.equal(second.id, first.id);
  assert.equal(second.content, "Synthetic revised version two");
  assert.deepEqual(
    second.revisions.map(({ revisionNumber, content }) => ({
      revisionNumber,
      content,
    })),
    [
      { revisionNumber: 2, content: "Synthetic revised version two" },
      { revisionNumber: 1, content: "Synthetic version one" },
    ],
  );
  assert.notEqual(second.revisions[0].id, second.revisions[1].id);

  const historyResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests?customerCompanyId=${customer.id}`,
  );
  const history = (await historyResponse.json()) as Array<{
    id: string;
    quoteDraftRevisionCount: number;
    quoteDraftUpdatedAt: string | null;
  }>;
  assert.equal(history[0].id, request.id);
  assert.equal(history[0].quoteDraftRevisionCount, 2);
  assert.equal(
    Date.parse(history[0].quoteDraftUpdatedAt ?? ""),
    Date.parse(second.revisions[0].createdAt),
  );

  await application.close();
  await startApplication();
  const persistedResponse = await staffFetch(
    `${baseUrl}/api/v1/quote-requests/${request.id}/draft`,
  );
  assert.equal(persistedResponse.status, 200);
  const persisted = (
    (await persistedResponse.json()) as { draft: typeof first }
  ).draft;
  assert.equal(persisted.content, "Synthetic revised version two");
  assert.equal(persisted.revisions.length, 2);
});
