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

export const jobStatusKeys = [
  "open",
  "in_progress",
  "on_hold",
  "ready_to_close",
  "closed",
  "cancelled",
] as const;
export type JobStatus = (typeof jobStatusKeys)[number];

/** Allowed moves. Leaving closed/cancelled is a reopen. */
export const jobStatusTransitions: Record<JobStatus, readonly JobStatus[]> = {
  open: ["in_progress", "on_hold", "closed", "cancelled"],
  in_progress: ["on_hold", "ready_to_close", "closed", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  ready_to_close: ["in_progress", "closed", "cancelled"],
  closed: ["in_progress"],
  cancelled: ["in_progress"],
};

/**
 * A written reason is required to cancel, to reopen a closed/cancelled job and
 * to close a job that was not first marked ready_to_close (a closure override).
 */
export function jobStatusReasonRequired(
  from: JobStatus,
  to: JobStatus,
): boolean {
  return (
    to === "cancelled" ||
    from === "closed" ||
    from === "cancelled" ||
    (to === "closed" && from !== "ready_to_close")
  );
}

export const jobStatusChangeInputSchema = z.object(
  {
    status: z.enum(jobStatusKeys, {
      error: "status is not a supported job status",
    }),
    reason: z
      .string({ error: "reason must be text" })
      .transform((value) => value.trim())
      .refine((value) => value.length <= 2000, {
        error: "reason must be at most 2000 characters",
      })
      .nullish()
      .transform((value) => value || null),
  },
  { error: "A status object is required" },
);
export type JobStatusChangeInput = z.infer<typeof jobStatusChangeInputSchema>;

export const partyRoleKeys = [
  "shipper",
  "consignee",
  "notify_party",
  "agent",
] as const;
export type PartyRole = (typeof partyRoleKeys)[number];

export const jobPartyInputSchema = z.object(
  {
    role: z.enum(partyRoleKeys, {
      error: "role must be shipper, consignee, notify_party or agent",
    }),
    name: requiredText("name", 200),
    details: z
      .string({ error: "details must be text" })
      .transform((value) => value.trim())
      .refine((value) => value.length <= 1000, {
        error: "details must be at most 1000 characters",
      })
      .nullish()
      .transform((value) => value || null),
  },
  { error: "A party object is required" },
);
export type JobPartyInput = z.infer<typeof jobPartyInputSchema>;

export const referenceKindKeys = [
  "master_bl",
  "house_bl",
  "master_awb",
  "house_awb",
  "booking",
  "container",
] as const;
export type ReferenceKind = (typeof referenceKindKeys)[number];

const seaOnlyKinds: readonly ReferenceKind[] = [
  "master_bl",
  "house_bl",
  "container",
];
const airOnlyKinds: readonly ReferenceKind[] = ["master_awb", "house_awb"];

/** Bills of lading and containers belong to sea jobs, air waybills to air jobs. */
export function referenceKindAllowedFor(
  serviceLine: ServiceLine,
  kind: ReferenceKind,
): boolean {
  return serviceLine.startsWith("sea")
    ? !airOnlyKinds.includes(kind)
    : !seaOnlyKinds.includes(kind);
}

/** House documents hang under a master of the matching kind. */
export const referenceParentKind: Partial<
  Record<ReferenceKind, ReferenceKind>
> = { house_bl: "master_bl", house_awb: "master_awb" };

export const shipmentReferenceInputSchema = z.object(
  {
    kind: z.enum(referenceKindKeys, {
      error:
        "kind must be master_bl, house_bl, master_awb, house_awb, booking or container",
    }),
    value: requiredText("value", 80),
    sealNumber: z
      .string({ error: "sealNumber must be text" })
      .transform((value) => value.trim())
      .refine((value) => value.length <= 80, {
        error: "sealNumber must be at most 80 characters",
      })
      .nullish()
      .transform((value) => value || null),
    parentReferenceId: uuidField("parentReferenceId")
      .nullish()
      .transform((value) => value ?? null),
  },
  { error: "A reference object is required" },
);
export type ShipmentReferenceInput = z.infer<
  typeof shipmentReferenceInputSchema
>;

export interface MilestoneDefinition {
  key: string;
  label: string;
}

/**
 * Sea import sequence as the client described it (client-derived; order is
 * indicative and not enforced).
 * Milestones are not enforced in order: real jobs overlap.
 */
export const seaImportMilestones: readonly MilestoneDefinition[] = [
  { key: "cargo_arrived", label: "Cargo arrived; customer updated" },
  {
    key: "customs_declaration_submitted",
    label: "Documents entered with customs",
  },
  { key: "duties_assessed", label: "Customs tax / duties generated" },
  { key: "customer_invoice_issued", label: "Bill issued to customer" },
  { key: "customer_payment_recorded", label: "Customer payment recorded" },
  {
    key: "port_charges_paid",
    label: "Port, terminal and other charges paid",
  },
  {
    key: "container_released_by_line",
    label: "Container released by shipping line",
  },
  { key: "terminal_booked", label: "Terminal charges booked" },
  { key: "customs_inspection_completed", label: "Customs inspection done" },
  {
    key: "customs_released",
    label: "Customs released; delivery authorisation received",
  },
  { key: "container_dispatched", label: "Container loaded and dispatched" },
  {
    key: "delivery_note_signed",
    label: "Delivered; delivery note signed by consignee",
  },
  {
    key: "empty_container_returned",
    label: "Empty container returned to terminal",
  },
  { key: "eir_received", label: "EIR (equipment condition) received" },
];

/** Sea export, as the client described it: invoice, booking, stuffing, customs, shipping. */
export const seaExportMilestones: readonly MilestoneDefinition[] = [
  { key: "customer_invoice_issued", label: "Cost arranged; invoice sent" },
  { key: "vessel_booked", label: "Vessel booked" },
  {
    key: "container_sent_to_customer",
    label: "Container sent to customer for loading",
  },
  { key: "container_stuffed", label: "Container stuffed" },
  {
    key: "container_returned_to_port",
    label: "Loaded container returned to port",
  },
  { key: "customs_processed", label: "Customs process done" },
  { key: "customs_released", label: "Customs release received" },
  {
    key: "terminal_charges_paid",
    label: "Terminal handling charges paid",
  },
  { key: "container_shipped", label: "Container shipped out" },
  {
    key: "final_invoice_or_waybill_issued",
    label: "Final invoice / waybill issued to customer",
  },
];

/** Air import: the same clearance and delivery steps as sea, without container steps or EIR. */
export const airImportMilestones: readonly MilestoneDefinition[] = [
  { key: "cargo_arrived", label: "Cargo arrived; customer updated" },
  {
    key: "customs_declaration_submitted",
    label: "Documents entered with customs",
  },
  { key: "duties_assessed", label: "Customs tax / duties generated" },
  { key: "customer_invoice_issued", label: "Bill issued to customer" },
  { key: "customer_payment_recorded", label: "Customer payment recorded" },
  { key: "airport_charges_paid", label: "Airport and other charges paid" },
  { key: "customs_released", label: "Customs released cargo" },
  {
    key: "delivery_note_signed",
    label: "Delivered; delivery note signed by consignee",
  },
];

/** Air export: booking, customs, charges, departure and waybill. */
export const airExportMilestones: readonly MilestoneDefinition[] = [
  { key: "air_booked", label: "Air booking made with airline" },
  {
    key: "cargo_received_from_customer",
    label: "Goods received from customer",
  },
  { key: "customs_arranged", label: "Customs arrangements made" },
  { key: "customs_released", label: "Customs released goods" },
  {
    key: "airport_airline_charges_paid",
    label: "Airport and airline charges paid",
  },
  { key: "cargo_departed", label: "Cargo left Ghana" },
  { key: "waybill_issued", label: "Waybill issued" },
];

export const milestoneTemplates: Record<
  ServiceLine,
  readonly MilestoneDefinition[]
> = {
  sea_import: seaImportMilestones,
  sea_export: seaExportMilestones,
  air_import: airImportMilestones,
  air_export: airExportMilestones,
};

export const milestoneEventInputSchema = z.object(
  {
    milestoneKey: requiredText("milestoneKey", 80),
    occurredAt: z
      .string({ error: "occurredAt must be a date and time" })
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        error: "occurredAt must be a date and time",
      })
      .nullish()
      .transform((value) => (value ? new Date(value).toISOString() : null)),
    note: z
      .string({ error: "note must be text" })
      .transform((value) => value.trim())
      .refine((value) => value.length <= 2000, {
        error: "note must be at most 2000 characters",
      })
      .nullish()
      .transform((value) => value || null),
    correctionOf: uuidField("correctionOf")
      .nullish()
      .transform((value) => value ?? null),
  },
  objectError("A milestone object is required"),
);
export type MilestoneEventInput = z.infer<typeof milestoneEventInputSchema>;

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
