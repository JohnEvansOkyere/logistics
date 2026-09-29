import { z } from "zod";

export const departmentRoleKeys = [
  "air_import_rep",
  "air_export_rep",
  "sea_import_rep",
  "sea_export_rep",
] as const;
export const staffRoleKeys = ["super_admin", ...departmentRoleKeys] as const;

export type DepartmentRoleKey = (typeof departmentRoleKeys)[number];
export type StaffRoleKey = (typeof staffRoleKeys)[number];

export const serviceLineKeys = [
  "sea_import",
  "sea_export",
  "air_import",
  "air_export",
] as const;
export type ServiceLine = (typeof serviceLineKeys)[number];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, required text of 1..max characters, with the API's error wording. */
function requiredText(field: string, maximumLength: number) {
  return z
    .string({ error: `${field} is required` })
    .transform((value) => value.trim())
    .refine((value) => value.length >= 1 && value.length <= maximumLength, {
      error: `${field} must contain 1 to ${maximumLength} characters`,
    });
}

const emailField = requiredText("email", 254).refine(
  (value) => EMAIL_PATTERN.test(value),
  { error: "email must be a valid email address" },
);

const objectError = (message: string) => ({ error: message });

export const customerInputSchema = z.object(
  {
    companyName: requiredText("companyName", 160),
    contactName: requiredText("contactName", 160),
    email: emailField,
  },
  objectError("A customer object is required"),
);
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const quoteRequestInputSchema = z.object(
  {
    companyName: requiredText("companyName", 160),
    contactName: requiredText("contactName", 160),
    email: emailField,
    message: requiredText("message", 5000),
  },
  objectError("A quote request object is required"),
);
export type QuoteRequestInput = z.infer<typeof quoteRequestInputSchema>;

export const quoteDraftInputSchema = z.object(
  {
    content: requiredText("content", 20000),
  },
  objectError("A quote draft object is required"),
);
export type QuoteDraftInput = z.infer<typeof quoteDraftInputSchema>;

export const departmentAssignmentInputSchema = z.object(
  {
    roleKey: z.union([z.enum(departmentRoleKeys), z.null()], {
      error: "roleKey must be a department role or null",
    }),
  },
  objectError("A department role is required"),
);
export type DepartmentAssignmentInput = z.infer<
  typeof departmentAssignmentInputSchema
>;

const staffRoleField = z.enum(staffRoleKeys, {
  error: "roleKey is not a supported staff role",
});

export const staffRoleInputSchema = z.object(
  {
    email: z.string().optional().catch(undefined),
    roleKey: staffRoleField,
  },
  objectError("A roleKey is required"),
);
export type StaffRoleInput = z.infer<typeof staffRoleInputSchema>;

export const staffCreateInputSchema = z.object(
  {
    email: z.string().catch(""),
    password: z.string().catch(""),
    roleKey: staffRoleField,
  },
  objectError("Email, password and roleKey are required"),
);
export type StaffCreateInput = z.infer<typeof staffCreateInputSchema>;

const uuidField = (field: string) =>
  z
    .string({ error: `${field} is required` })
    .refine(isUuid, { error: `${field} must be a valid ID` });

export const jobCreateInputSchema = z.object(
  {
    customerCompanyId: uuidField("customerCompanyId"),
    serviceLine: z.enum(serviceLineKeys, {
      error:
        "serviceLine must be sea_import, sea_export, air_import or air_export",
    }),
    quoteRequestId: uuidField("quoteRequestId")
      .nullish()
      .transform((v) => v ?? null),
  },
  objectError("A job object is required"),
);
export type JobCreateInput = z.infer<typeof jobCreateInputSchema>;

/**
 * Parses untrusted input with a contract schema. Returns the parsed value or
 * the first issue's message, so callers can raise their own HTTP error.
 */
export function parseContract<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; message: string } {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, message: result.error.issues[0].message };
}
