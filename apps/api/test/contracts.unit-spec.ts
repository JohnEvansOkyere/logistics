import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerInputSchema,
  departmentAssignmentInputSchema,
  parseContract,
  quoteDraftInputSchema,
  quoteRequestInputSchema,
  staffCreateInputSchema,
  staffRoleInputSchema,
} from "@bjh/contracts";

const message = (
  schema: Parameters<typeof parseContract>[0],
  input: unknown,
) => {
  const result = parseContract(schema, input);
  return result.success ? "ok" : result.message;
};

test("customer contract trims text and rejects invalid bodies with API wording", () => {
  const valid = parseContract(customerInputSchema, {
    companyName: "  Northstar Synthetic Ltd ",
    contactName: "Contact",
    email: "contact@example.test",
  });
  assert.deepEqual(valid, {
    success: true,
    data: {
      companyName: "Northstar Synthetic Ltd",
      contactName: "Contact",
      email: "contact@example.test",
    },
  });
  assert.equal(
    message(customerInputSchema, null),
    "A customer object is required",
  );
  assert.equal(
    message(customerInputSchema, []),
    "A customer object is required",
  );
  assert.equal(
    message(customerInputSchema, { contactName: "c", email: "a@b.co" }),
    "companyName is required",
  );
  assert.equal(
    message(customerInputSchema, {
      companyName: "x".repeat(161),
      contactName: "c",
      email: "a@b.co",
    }),
    "companyName must contain 1 to 160 characters",
  );
  assert.equal(
    message(customerInputSchema, {
      companyName: "n",
      contactName: "c",
      email: "not-an-email",
    }),
    "email must be a valid email address",
  );
});

test("quote request contract enforces the message length", () => {
  const base = {
    companyName: "n",
    contactName: "c",
    email: "a@b.co",
  };
  assert.equal(
    message(quoteRequestInputSchema, { ...base, message: "hi" }),
    "ok",
  );
  assert.equal(
    message(quoteRequestInputSchema, { ...base, message: " " }),
    "message must contain 1 to 5000 characters",
  );
  assert.equal(
    message(quoteRequestInputSchema, "text"),
    "A quote request object is required",
  );
});

test("quote draft and department contracts", () => {
  assert.equal(message(quoteDraftInputSchema, { content: " draft " }), "ok");
  assert.equal(
    message(quoteDraftInputSchema, { content: "x".repeat(20001) }),
    "content must contain 1 to 20000 characters",
  );
  assert.equal(
    message(departmentAssignmentInputSchema, { roleKey: null }),
    "ok",
  );
  assert.equal(
    message(departmentAssignmentInputSchema, { roleKey: "sea_import_rep" }),
    "ok",
  );
  for (const roleKey of ["super_admin", "nope", undefined, 1]) {
    assert.equal(
      message(departmentAssignmentInputSchema, { roleKey }),
      "roleKey must be a department role or null",
    );
  }
  assert.equal(
    message(departmentAssignmentInputSchema, null),
    "A department role is required",
  );
});

test("staff contracts reject unsupported roles and tolerate missing strings", () => {
  assert.equal(
    message(staffRoleInputSchema, { roleKey: "boss" }),
    "roleKey is not a supported staff role",
  );
  assert.equal(message(staffRoleInputSchema, { roleKey: "super_admin" }), "ok");
  assert.equal(message(staffRoleInputSchema, null), "A roleKey is required");
  const created = parseContract(staffCreateInputSchema, {
    email: 5,
    roleKey: "air_import_rep",
  });
  assert.deepEqual(created, {
    success: true,
    data: { email: "", password: "", roleKey: "air_import_rep" },
  });
  assert.equal(
    message(staffCreateInputSchema, undefined),
    "Email, password and roleKey are required",
  );
});
