import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  invoiceFromChargesInputSchema,
  invoiceInputSchema,
  invoiceReasonInputSchema,
  isUuid,
  parseContract,
  paymentInputSchema,
} from "@bjh/contracts";
import {
  DatabasePort,
  InvoicePaymentRecord,
  InvoiceRecord,
  JobRecord,
  JobScope,
} from "../database/database.port";
import { JobsService } from "../jobs/jobs.service";
import { JobChargesService } from "./job-charges.service";
import { computeInvoiceTotals } from "./invoice-totals";
import { renderInvoicePdf } from "./invoice-pdf";

export interface InvoiceView extends InvoiceRecord {
  /** Payments still standing (not reversed). */
  paidMinor: number;
  /** What is still owed: zero for drafts and voided invoices. */
  outstandingMinor: number;
  paymentStatus: "draft" | "void" | "unpaid" | "partial" | "paid";
  /** The full ledger, for staff only; customers see the balance, not the ledger. */
  payments?: InvoicePaymentRecord[];
}

/**
 * Customer invoices on a job and the payments staff record against them.
 * A draft is editable; issuing numbers it and freezes lines, tax and totals;
 * a mistake is corrected by voiding and issuing a new invoice. Payments are
 * received outside the system, never reduce below zero, and are reversed, not
 * edited. The balance is always derived from the standing payments.
 */
@Injectable()
export class InvoicesService {
  constructor(
    @Inject(DatabasePort) private readonly database: DatabasePort,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(JobChargesService) private readonly charges: JobChargesService,
  ) {}

  async list(id: string, scope: JobScope): Promise<InvoiceView[]> {
    const job = await this.jobs.get(id, scope);
    const isCustomer = scope.companyIds !== undefined;
    const [invoices, payments] = await Promise.all([
      this.database.listInvoices(job.id),
      this.database.listInvoicePayments(job.id),
    ]);
    return (
      invoices
        // A draft, even one voided before issue, was never sent to the customer.
        .filter((invoice) => !isCustomer || invoice.issuedAt !== null)
        .map((invoice) =>
          this.view(
            invoice,
            payments.filter((payment) => payment.invoiceId === invoice.id),
            !isCustomer,
          ),
        )
    );
  }

  async create(
    id: string,
    input: unknown,
    createdBy: string,
    scope: JobScope,
  ): Promise<InvoiceView> {
    const job = await this.editableJob(id, scope);
    const parsed = parseContract(invoiceInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const settings = await this.requireConfiguredCurrency(parsed.data.currency);
    const invoice = await this.database.createInvoice({
      jobId: job.id,
      currency: parsed.data.currency,
      lines: parsed.data.lines,
      dueDate: parsed.data.dueDate,
      notes: parsed.data.notes,
      totals: computeInvoiceTotals(parsed.data.lines, settings?.taxLines ?? []),
      createdBy,
    });
    return this.view(invoice, [], true);
  }

  /**
   * Starts a draft from the job's charges: each charge in the invoice currency
   * becomes a line at its current actual amount, or its quoted total when no
   * actual is recorded. Charges with neither are skipped and counted.
   */
  async createFromCharges(
    id: string,
    input: unknown,
    createdBy: string,
    scope: JobScope,
  ): Promise<{ invoice: InvoiceView; skipped: number }> {
    const job = await this.editableJob(id, scope);
    const parsed = parseContract(invoiceFromChargesInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const settings = await this.requireConfiguredCurrency(parsed.data.currency);

    const { charges } = await this.charges.list(job.id, scope);
    const inCurrency = charges.filter(
      (charge) => charge.currency === parsed.data.currency,
    );
    const lines = inCurrency.flatMap((charge) => {
      const amount =
        charge.currentActual?.convertedMinor ?? charge.quotedTotalMinor;
      return amount === null
        ? []
        : [
            {
              description: charge.description,
              amountMinor: amount,
              taxable: true,
            },
          ];
    });
    if (lines.length === 0) {
      throw new ConflictException(
        `No charge on this job has an amount in ${parsed.data.currency} to invoice`,
      );
    }
    const invoice = await this.database.createInvoice({
      jobId: job.id,
      currency: parsed.data.currency,
      lines,
      dueDate: parsed.data.dueDate,
      notes: parsed.data.notes,
      totals: computeInvoiceTotals(lines, settings?.taxLines ?? []),
      createdBy,
    });
    return {
      invoice: this.view(invoice, [], true),
      skipped: inCurrency.length - lines.length,
    };
  }

  async update(
    id: string,
    invoiceId: string,
    input: unknown,
    scope: JobScope,
  ): Promise<InvoiceView> {
    const job = await this.editableJob(id, scope);
    const parsed = parseContract(invoiceInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const settings = await this.requireConfiguredCurrency(parsed.data.currency);
    const result = isUuid(invoiceId)
      ? await this.database.updateDraftInvoice(job.id, invoiceId, {
          currency: parsed.data.currency,
          lines: parsed.data.lines,
          dueDate: parsed.data.dueDate,
          notes: parsed.data.notes,
          totals: computeInvoiceTotals(
            parsed.data.lines,
            settings?.taxLines ?? [],
          ),
        })
      : "not_found";
    if (result === "not_found") {
      throw new NotFoundException("Invoice was not found on this job");
    }
    if (result === "not_draft") {
      throw new ConflictException(
        "Only a draft invoice can be edited; void this one and issue a new invoice",
      );
    }
    return this.view(result, [], true);
  }

  /** Numbers the invoice and freezes its lines, tax lines and totals. */
  async issue(
    id: string,
    invoiceId: string,
    issuedBy: string,
    scope: JobScope,
  ): Promise<InvoiceView> {
    const job = await this.editableJob(id, scope);
    const invoice = await this.find(job.id, invoiceId);
    const current = await this.database.getBusinessSettings();
    if (!current) {
      throw new ConflictException(
        "Configure the business settings before issuing an invoice",
      );
    }
    const settings = current.settings;
    if (!settings.currencies.includes(invoice.currency)) {
      throw new BadRequestException(
        `currency must be one of the configured currencies: ${settings.currencies.join(", ")}`,
      );
    }
    const dueDate =
      invoice.dueDate ??
      (settings.paymentTermsDays === null
        ? null
        : new Date(Date.now() + settings.paymentTermsDays * 86_400_000)
            .toISOString()
            .slice(0, 10));
    const result = await this.database.issueInvoice(job.id, invoice.id, {
      issuedBy,
      year: new Date().getUTCFullYear(),
      dueDate,
      totals: computeInvoiceTotals(invoice.lines, settings.taxLines),
    });
    if (result === "not_found") {
      throw new NotFoundException("Invoice was not found on this job");
    }
    if (result === "not_draft") {
      throw new ConflictException("This invoice is already issued or void");
    }
    if (result === "no_lines") {
      throw new BadRequestException("Add at least one line before issuing");
    }
    return this.view(result, [], true);
  }

  async voidInvoice(
    id: string,
    invoiceId: string,
    input: unknown,
    voidedBy: string,
    scope: JobScope,
  ): Promise<InvoiceView> {
    const job = await this.editableJob(id, scope);
    const parsed = parseContract(invoiceReasonInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const result = isUuid(invoiceId)
      ? await this.database.voidInvoice(
          job.id,
          invoiceId,
          voidedBy,
          parsed.data.reason,
        )
      : "not_found";
    if (result === "not_found") {
      throw new NotFoundException("Invoice was not found on this job");
    }
    if (result === "already_void") {
      throw new ConflictException("This invoice is already void");
    }
    if (result === "has_payments") {
      throw new ConflictException(
        "Reverse the payments before voiding the invoice",
      );
    }
    return this.view(result, [], true);
  }

  /** Payments may arrive after a job is closed, so the job status is not checked. */
  async recordPayment(
    id: string,
    invoiceId: string,
    input: unknown,
    recordedBy: string,
    scope: JobScope,
  ): Promise<InvoicePaymentRecord> {
    const job = await this.jobs.get(id, scope);
    const parsed = parseContract(paymentInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    // One day of slack covers a client whose date is ahead of UTC.
    if (
      parsed.data.receivedOn >
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    ) {
      throw new BadRequestException("receivedOn cannot be in the future");
    }
    const result = isUuid(invoiceId)
      ? await this.database.recordInvoicePayment(
          job.id,
          invoiceId,
          parsed.data,
          recordedBy,
        )
      : "not_found";
    if (result === "not_found") {
      throw new NotFoundException("Invoice was not found on this job");
    }
    if (result === "not_issued") {
      throw new ConflictException(
        "Payments can only be recorded against an issued invoice",
      );
    }
    if (result === "exceeds_balance") {
      throw new ConflictException(
        "The payment is more than the outstanding balance",
      );
    }
    if (result === "document_invalid") {
      throw new BadRequestException(
        "evidenceDocumentId must be a document on this job",
      );
    }
    return result;
  }

  async reversePayment(
    id: string,
    invoiceId: string,
    paymentId: string,
    input: unknown,
    reversedBy: string,
    scope: JobScope,
  ): Promise<InvoicePaymentRecord> {
    const job = await this.jobs.get(id, scope);
    const parsed = parseContract(invoiceReasonInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const result =
      isUuid(invoiceId) && isUuid(paymentId)
        ? await this.database.reverseInvoicePayment(
            job.id,
            invoiceId,
            paymentId,
            parsed.data.reason,
            reversedBy,
          )
        : "not_found";
    if (result === "not_found") {
      throw new NotFoundException("Payment was not found on this invoice");
    }
    if (result === "already_reversed") {
      throw new ConflictException("This payment is already reversed");
    }
    return result;
  }

  /** Customers reach only invoices that were issued, on their own company's jobs. */
  async pdf(
    id: string,
    invoiceId: string,
    scope: JobScope,
  ): Promise<{ file: Buffer; filename: string }> {
    const job = await this.jobs.get(id, scope);
    const invoice = await this.find(job.id, invoiceId);
    if (scope.companyIds !== undefined && invoice.issuedAt === null) {
      throw new NotFoundException("Invoice was not found on this job");
    }
    const [payments, settings] = await Promise.all([
      this.database.listInvoicePayments(job.id),
      this.database.getBusinessSettings(),
    ]);
    const view = this.view(
      invoice,
      payments.filter((payment) => payment.invoiceId === invoice.id),
      false,
    );
    const file = await renderInvoicePdf({
      invoice: view,
      job,
      settings: settings?.settings ?? null,
    });
    const base = (invoice.invoiceNumber ?? "invoice-draft").replace(
      /[^A-Za-z0-9-]+/g,
      "-",
    );
    return { file, filename: `${base}.pdf` };
  }

  private view(
    invoice: InvoiceRecord,
    payments: InvoicePaymentRecord[],
    includeLedger: boolean,
  ): InvoiceView {
    const paidMinor = payments
      .filter((payment) => payment.reversal === null)
      .reduce((sum, payment) => sum + payment.amountMinor, 0);
    const open = invoice.status === "issued";
    const outstandingMinor = open ? invoice.totalMinor - paidMinor : 0;
    const paymentStatus =
      invoice.status !== "issued"
        ? invoice.status
        : paidMinor === 0
          ? "unpaid"
          : outstandingMinor === 0
            ? "paid"
            : "partial";
    return {
      ...invoice,
      paidMinor,
      outstandingMinor,
      paymentStatus,
      ...(includeLedger ? { payments } : {}),
    };
  }

  private async find(jobId: string, invoiceId: string): Promise<InvoiceRecord> {
    const invoice = isUuid(invoiceId)
      ? (await this.database.listInvoices(jobId)).find(
          (item) => item.id === invoiceId,
        )
      : undefined;
    if (!invoice) {
      throw new NotFoundException("Invoice was not found on this job");
    }
    return invoice;
  }

  /** The current settings, after checking the currency is one of theirs. */
  private async requireConfiguredCurrency(currency: string) {
    const current = await this.database.getBusinessSettings();
    if (current && !current.settings.currencies.includes(currency)) {
      throw new BadRequestException(
        `currency must be one of the configured currencies: ${current.settings.currencies.join(", ")}`,
      );
    }
    return current?.settings ?? null;
  }

  private async editableJob(id: string, scope: JobScope): Promise<JobRecord> {
    const job = await this.jobs.get(id, scope);
    if (job.status === "closed" || job.status === "cancelled") {
      throw new ConflictException("Reopen the job before changing it");
    }
    return job;
  }
}
