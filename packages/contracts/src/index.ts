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

export const documentTypeLabels = {
  bill_of_lading: "Bill of lading",
  airway_bill: "Airway bill",
  commercial_invoice: "Commercial invoice",
  packing_list: "Packing list",
  customs_document: "Customs document",
  delivery_note: "Delivery note / proof of delivery",
  eir: "EIR (equipment interchange receipt)",
  supplier_invoice: "Supplier invoice",
  disbursement_evidence: "Disbursement evidence",
  office_letter: "Office letter",
  other: "Other",
} as const;
export type DocumentType = keyof typeof documentTypeLabels;
export const documentTypeKeys = Object.keys(
  documentTypeLabels,
) as DocumentType[];

/** Fields sent with an uploaded file; documentId adds a new version to an existing document. */
export const documentUploadFieldsSchema = z.object(
  {
    documentType: z.enum(
      documentTypeKeys as [DocumentType, ...DocumentType[]],
      {
        error: "documentType is required and must be a supported document type",
      },
    ),
    documentId: uuidField("documentId")
      .nullish()
      .transform((value) => value ?? null),
  },
  { error: "Upload details are required" },
);
export type DocumentUploadFields = z.infer<typeof documentUploadFieldsSchema>;

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

export const etaInputSchema = z.object(
  {
    etaAt: z
      .string({ error: "etaAt is required" })
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        error: "etaAt must be a date and time",
      })
      .transform((value) => new Date(value).toISOString()),
    source: requiredText("source", 200),
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
  objectError("An ETA object is required"),
);
export type EtaInput = z.infer<typeof etaInputSchema>;

export const taskKinds = [
  "task",
  "missing_documents",
  "damage",
  "delay",
  "other",
] as const;
export type TaskKind = (typeof taskKinds)[number];

const optionalText = (field: string, maximumLength: number) =>
  z
    .string({ error: `${field} must be text` })
    .transform((value) => value.trim())
    .refine((value) => value.length <= maximumLength, {
      error: `${field} must be at most ${maximumLength} characters`,
    })
    .nullish()
    .transform((value) => value || null);

export const jobTaskInputSchema = z.object(
  {
    kind: z
      .enum(taskKinds, { error: `kind must be one of ${taskKinds.join(", ")}` })
      .default("task"),
    title: requiredText("title", 200),
    details: optionalText("details", 2000),
    assignedRole: z.enum(staffRoleKeys, {
      error: `assignedRole must be one of ${staffRoleKeys.join(", ")}`,
    }),
    dueDate: z
      .string({ error: "dueDate must be a date (YYYY-MM-DD)" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        error: "dueDate must be a date (YYYY-MM-DD)",
      })
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
        error: "dueDate must be a date (YYYY-MM-DD)",
      })
      .nullish()
      .transform((value) => value ?? null),
  },
  objectError("A task object is required"),
);
export type JobTaskInput = z.infer<typeof jobTaskInputSchema>;

export const taskCompletionSchema = z.object(
  { note: optionalText("note", 2000) },
  objectError("A completion object is required"),
);

export const quoteBasisKeys = [
  "fixed",
  "per_bl",
  "per_container",
  "at_cost",
] as const;
export type QuoteBasis = (typeof quoteBasisKeys)[number];

export const quoteBasisLabels: Record<QuoteBasis, string> = {
  fixed: "Fixed",
  per_bl: "Per bill of lading",
  per_container: "Per container",
  at_cost: "At cost",
};

const MAX_MINOR_AMOUNT = 1_000_000_000_000;
const minorAmount = (field: string) =>
  z
    .number({ error: `${field} must be a whole number of minor units` })
    .int({ error: `${field} must be a whole number of minor units` })
    .min(0, { error: `${field} cannot be negative` })
    .max(MAX_MINOR_AMOUNT, { error: `${field} is too large` })
    .nullish()
    .transform((value) => value ?? null);

const textList = (field: string, maximumItems: number, maximumLength: number) =>
  z
    .array(
      z
        .string({ error: `${field} must be a list of text` })
        .transform((value) => value.trim())
        .refine((value) => value.length >= 1 && value.length <= maximumLength, {
          error: `each ${field} entry must contain 1 to ${maximumLength} characters`,
        }),
      { error: `${field} must be a list of text` },
    )
    .max(maximumItems, {
      error: `${field} can have at most ${maximumItems} entries`,
    })
    .nullish()
    .transform((value) => value ?? []);

/** One charge row: a single amount, or a 20ft and a 40ft amount together. */
export const quoteLineInputSchema = z
  .object(
    {
      section: optionalText("section", 200),
      description: requiredText("description", 300),
      basis: z.enum(quoteBasisKeys, {
        error: `basis must be one of ${quoteBasisKeys.join(", ")}`,
      }),
      basisNote: optionalText("basisNote", 300),
      amountMinor: minorAmount("amountMinor"),
      amount20ftMinor: minorAmount("amount20ftMinor"),
      amount40ftMinor: minorAmount("amount40ftMinor"),
    },
    objectError("A charge line object is required"),
  )
  .superRefine((line, context) => {
    const sized =
      line.amount20ftMinor !== null || line.amount40ftMinor !== null;
    if ((line.amount20ftMinor === null) !== (line.amount40ftMinor === null)) {
      context.addIssue({
        code: "custom",
        message: "Give both the 20ft and the 40ft amount, or neither",
      });
    } else if (sized && line.amountMinor !== null) {
      context.addIssue({
        code: "custom",
        message: "Use either one amount or 20ft and 40ft amounts, not both",
      });
    } else if (
      line.basis !== "at_cost" &&
      line.amountMinor === null &&
      !sized
    ) {
      context.addIssue({
        code: "custom",
        message: "Only at-cost lines can leave the amount out",
      });
    }
  });
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;

export const quoteVersionInputSchema = z.object(
  {
    currency: z
      .string({ error: "currency is required" })
      .transform((value) => value.trim().toUpperCase())
      .refine((value) => /^[A-Z]{3}$/.test(value), {
        error: "currency must be a 3-letter code such as USD or GHS",
      }),
    title: requiredText("title", 200),
    subtitle: optionalText("subtitle", 200),
    shipmentScope: optionalText("shipmentScope", 500),
    intro: optionalText("intro", 4000),
    atCostNote: optionalText("atCostNote", 2000),
    procedureSteps: textList("procedureSteps", 30, 1000),
    requiredDocuments: textList("requiredDocuments", 30, 300),
    documentsNote: optionalText("documentsNote", 2000),
    timeline: optionalText("timeline", 2000),
    terms: textList("terms", 30, 1000),
    lines: z
      .array(quoteLineInputSchema, { error: "lines must be a list" })
      .max(100, { error: "A quote can have at most 100 charge lines" }),
  },
  objectError("A quote version object is required"),
);
export type QuoteVersionInput = z.infer<typeof quoteVersionInputSchema>;

export const quoteCreateInputSchema = z.object(
  {
    customerCompanyId: uuidField("customerCompanyId"),
    serviceLine: z.enum(serviceLineKeys, {
      error:
        "serviceLine must be sea_import, sea_export, air_import or air_export",
    }),
    quoteRequestId: uuidField("quoteRequestId")
      .nullish()
      .transform((value) => value ?? null),
    version: quoteVersionInputSchema,
  },
  objectError("A quote object is required"),
);
export type QuoteCreateInput = z.infer<typeof quoteCreateInputSchema>;

export const quoteDecisionKeys = ["accepted", "rejected"] as const;
export type QuoteDecision = (typeof quoteDecisionKeys)[number];

/** Staff record the client's decision on one issued version of a quote. */
export const quoteDecisionInputSchema = z.object(
  {
    versionNumber: z
      .number({ error: "versionNumber is required" })
      .int({ error: "versionNumber must be a whole number" })
      .min(1, { error: "versionNumber must be a whole number" }),
    decision: z.enum(quoteDecisionKeys, {
      error: "decision must be accepted or rejected",
    }),
    clientSignatory: requiredText("clientSignatory", 160),
    decidedAt: z
      .string({ error: "decidedAt must be a date and time" })
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        error: "decidedAt must be a date and time",
      })
      .nullish()
      .transform((value) => (value ? new Date(value).toISOString() : null)),
    note: optionalText("note", 2000),
  },
  objectError("A quote decision object is required"),
);
export type QuoteDecisionInput = z.infer<typeof quoteDecisionInputSchema>;

const PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/-]{0,19}$/;
const prefixField = (field: string) =>
  z
    .string({ error: `${field} is required` })
    .transform((value) => value.trim())
    .refine((value) => PREFIX_PATTERN.test(value), {
      error: `${field} must be 1 to 20 letters, digits, "/" or "-"`,
    });

const optionalEmail = z
  .string({ error: "email must be text" })
  .transform((value) => value.trim())
  .refine((value) => value === "" || EMAIL_PATTERN.test(value), {
    error: "email must be a valid email address",
  })
  .nullish()
  .transform((value) => value || null);

/**
 * BJH's business settings. Tax rates are basis points (1500 = 15%); how levies
 * combine on an invoice is decided with the invoice work (F3), not here.
 */
export const businessSettingsSchema = z
  .object(
    {
      issuer: z.object(
        {
          name: requiredText("issuer name", 160),
          address: optionalText("issuer address", 500),
          phone: optionalText("issuer phone", 80),
          email: optionalEmail,
          website: optionalText("issuer website", 200),
        },
        objectError("issuer details are required"),
      ),
      currencies: z
        .array(
          z
            .string({ error: "currencies must be 3-letter codes" })
            .transform((value) => value.trim().toUpperCase())
            .refine((value) => /^[A-Z]{3}$/.test(value), {
              error: "currencies must be 3-letter codes such as USD or GHS",
            }),
          { error: "currencies must be a list of 3-letter codes" },
        )
        .min(1, { error: "Configure at least one currency" })
        .max(10, { error: "At most 10 currencies can be configured" }),
      defaultCurrency: z
        .string({ error: "defaultCurrency is required" })
        .transform((value) => value.trim().toUpperCase()),
      taxLines: z
        .array(
          z.object(
            {
              name: requiredText("tax line name", 80),
              rateBasisPoints: z
                .number({ error: "rateBasisPoints must be a whole number" })
                .int({ error: "rateBasisPoints must be a whole number" })
                .min(0, { error: "rateBasisPoints must be 0 to 10000" })
                .max(10000, { error: "rateBasisPoints must be 0 to 10000" }),
            },
            objectError("A tax line object is required"),
          ),
          { error: "taxLines must be a list" },
        )
        .max(10, { error: "At most 10 tax lines can be configured" })
        .nullish()
        .transform((value) => value ?? []),
      paymentTermsDays: z
        .number({ error: "paymentTermsDays must be a whole number" })
        .int({ error: "paymentTermsDays must be a whole number" })
        .min(0, { error: "paymentTermsDays must be 0 to 365" })
        .max(365, { error: "paymentTermsDays must be 0 to 365" })
        .nullish()
        .transform((value) => value ?? null),
      numbering: z.object(
        {
          quotePrefix: prefixField("quotePrefix"),
          invoicePrefix: prefixField("invoicePrefix"),
          receiptPrefix: prefixField("receiptPrefix"),
        },
        objectError("numbering prefixes are required"),
      ),
      quoteDefaults: z
        .object(
          {
            intro: optionalText("quote intro", 4000),
            atCostNote: optionalText("at-cost note", 2000),
            procedureSteps: textList("procedureSteps", 30, 1000),
            requiredDocuments: textList("requiredDocuments", 30, 300),
            documentsNote: optionalText("documents note", 2000),
            timeline: optionalText("timeline", 2000),
            terms: textList("terms", 30, 1000),
          },
          objectError("quoteDefaults must be an object"),
        )
        .nullish()
        .transform(
          (value) =>
            value ?? {
              intro: null,
              atCostNote: null,
              procedureSteps: [],
              requiredDocuments: [],
              documentsNote: null,
              timeline: null,
              terms: [],
            },
        ),
    },
    objectError("A settings object is required"),
  )
  .superRefine((settings, context) => {
    if (new Set(settings.currencies).size !== settings.currencies.length) {
      context.addIssue({
        code: "custom",
        message: "currencies must not repeat",
      });
    } else if (!settings.currencies.includes(settings.defaultCurrency)) {
      context.addIssue({
        code: "custom",
        message: "defaultCurrency must be one of the configured currencies",
      });
    }
  });
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export const chargeKinds = ["service", "disbursement"] as const;
export type ChargeKind = (typeof chargeKinds)[number];
export const chargeKindLabels: Record<ChargeKind, string> = {
  service: "Service charge",
  disbursement: "Disbursement (third-party cost)",
};

const currencyCode = (field: string) =>
  z
    .string({ error: `${field} is required` })
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => /^[A-Z]{3}$/.test(value), {
      error: `${field} must be a 3-letter code such as USD or GHS`,
    });

export const jobChargeInputSchema = z.object(
  {
    kind: z.enum(chargeKinds, {
      error: `kind must be one of ${chargeKinds.join(", ")}`,
    }),
    description: requiredText("description", 300),
    currency: currencyCode("currency"),
    quantity: z
      .number({ error: "quantity must be a whole number" })
      .int({ error: "quantity must be a whole number" })
      .min(1, { error: "quantity must be 1 to 10000" })
      .max(10000, { error: "quantity must be 1 to 10000" })
      .nullish()
      .transform((value) => value ?? 1),
    unitQuotedMinor: minorAmount("unitQuotedMinor"),
  },
  objectError("A charge object is required"),
);
export type JobChargeInput = z.infer<typeof jobChargeInputSchema>;

/** An exchange rate as text, e.g. "15.2500": positive, up to 8 decimals. */
export const exchangeRateSchema = z
  .string({
    error: "exchangeRate must be a positive number with up to 8 decimals",
  })
  .transform((value) => value.trim())
  .refine((value) => /^\d{1,10}(\.\d{1,8})?$/.test(value), {
    error: "exchangeRate must be a positive number with up to 8 decimals",
  })
  .refine((value) => Number(value) > 0, {
    error: "exchangeRate must be a positive number with up to 8 decimals",
  });

export const chargeActualInputSchema = z.object(
  {
    amountMinor: z
      .number({ error: "amountMinor must be a whole number of minor units" })
      .int({ error: "amountMinor must be a whole number of minor units" })
      .min(0, { error: "amountMinor cannot be negative" })
      .max(MAX_MINOR_AMOUNT, { error: "amountMinor is too large" }),
    currency: currencyCode("currency"),
    exchangeRate: exchangeRateSchema.nullish().transform((v) => v ?? null),
    rateNote: optionalText("rateNote", 200),
    supplierDocumentId: uuidField("supplierDocumentId")
      .nullish()
      .transform((value) => value ?? null),
    note: optionalText("note", 2000),
    correctionOf: uuidField("correctionOf")
      .nullish()
      .transform((value) => value ?? null),
  },
  objectError("An actual amount object is required"),
);
export type ChargeActualInput = z.infer<typeof chargeActualInputSchema>;

export const chargeImportInputSchema = z.object(
  {
    containerSize: z
      .enum(["20ft", "40ft"], { error: "containerSize must be 20ft or 40ft" })
      .nullish()
      .transform((value) => value ?? null),
  },
  objectError("An import object is required"),
);
export type ChargeImportInput = z.infer<typeof chargeImportInputSchema>;

/**
 * Converts minor units with an exchange rate, rounding half up, using integer
 * arithmetic only (money never passes through floating point).
 */
export function convertMinor(
  amountMinor: number,
  exchangeRate: string,
): number {
  const [whole, fraction = ""] = exchangeRate.split(".");
  const scaled = BigInt(whole + fraction.padEnd(8, "0"));
  const half = BigInt(50_000_000);
  return Number((BigInt(amountMinor) * scaled + half) / BigInt(100_000_000));
}
