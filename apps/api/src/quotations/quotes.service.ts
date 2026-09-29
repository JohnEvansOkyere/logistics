import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isUuid,
  parseContract,
  quoteCreateInputSchema,
  quoteDecisionInputSchema,
  quoteVersionInputSchema,
} from "@bjh/contracts";
import { serviceLinesForRoles } from "../auth/auth.guards";
import {
  DatabasePort,
  JobRecord,
  JobScope,
  QuoteDecisionRecord,
  QuoteRecord,
  QuoteSummaryRecord,
  StaffRoleKey,
} from "../database/database.port";

/**
 * Structured quotes. A rep for the quote's service line (or the super admin)
 * prepares and issues versions directly; there is no approval step. Customers
 * only ever see issued versions of their own company's quotes.
 */
@Injectable()
export class QuotesService {
  constructor(@Inject(DatabasePort) private readonly database: DatabasePort) {}

  async create(
    input: unknown,
    createdBy: string,
    roles: StaffRoleKey[],
  ): Promise<QuoteRecord> {
    const parsed = parseContract(quoteCreateInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const { customerCompanyId, serviceLine, quoteRequestId } = parsed.data;

    if (
      !roles.includes("super_admin") &&
      !serviceLinesForRoles(roles).includes(serviceLine)
    ) {
      throw new ForbiddenException(
        "You can only prepare quotes for your own service line",
      );
    }
    if (!(await this.database.findCustomer(customerCompanyId))) {
      throw new NotFoundException("Customer company was not found");
    }
    if (quoteRequestId) {
      const quoteRequest = await this.database.findQuoteRequest(quoteRequestId);
      if (!quoteRequest) {
        throw new NotFoundException("Quote request was not found");
      }
      if (quoteRequest.customerCompanyId !== customerCompanyId) {
        throw new BadRequestException(
          "quoteRequestId must belong to the same customer company",
        );
      }
    }

    const id = await this.database.createQuote(parsed.data, createdBy);
    return this.get(id, {});
  }

  list(scope: JobScope): Promise<QuoteSummaryRecord[]> {
    return this.database.listQuotes(scope);
  }

  async get(id: string, scope: JobScope): Promise<QuoteRecord> {
    const quote = isUuid(id) ? await this.database.findQuote(id, scope) : null;
    if (!quote) throw new NotFoundException("Quote was not found");
    return quote;
  }

  /** Replaces the content of the quote's current draft version. */
  async saveDraft(
    id: string,
    input: unknown,
    scope: JobScope,
  ): Promise<QuoteRecord> {
    const quote = await this.get(id, scope);
    this.requireNotAccepted(quote);
    const parsed = parseContract(quoteVersionInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const result = await this.database.saveQuoteVersionDraft(
      quote.id,
      parsed.data,
    );
    if (result === "no_draft") {
      throw new ConflictException(
        "Issued versions cannot be edited; start a new version first",
      );
    }
    return this.get(quote.id, scope);
  }

  /** Starts a new draft as a copy of the latest version. */
  async startVersion(
    id: string,
    createdBy: string,
    scope: JobScope,
  ): Promise<QuoteRecord> {
    const quote = await this.get(id, scope);
    this.requireNotAccepted(quote);
    const result = await this.database.startQuoteVersion(quote.id, createdBy);
    if (result === "draft_exists") {
      throw new ConflictException("This quote already has a draft version");
    }
    return this.get(quote.id, scope);
  }

  /** Freezes the draft and makes it visible to the customer. */
  async issue(
    id: string,
    issuedBy: string,
    scope: JobScope,
  ): Promise<QuoteRecord> {
    const quote = await this.get(id, scope);
    this.requireNotAccepted(quote);
    const result = await this.database.issueQuoteVersion(
      quote.id,
      issuedBy,
      new Date().getUTCFullYear(),
    );
    if (result === "no_draft") {
      throw new ConflictException("There is no draft version to issue");
    }
    if (result === "no_lines") {
      throw new BadRequestException(
        "Add at least one charge line before issuing",
      );
    }
    return this.get(quote.id, scope);
  }

  /**
   * Staff record the client's decision on the latest issued version. Accepting
   * opens the job; repeating the same decision returns the same result.
   */
  async decide(
    id: string,
    input: unknown,
    recordedBy: string,
    scope: JobScope,
  ): Promise<{ decision: QuoteDecisionRecord; job: JobRecord | null }> {
    const quote = await this.get(id, scope);
    const parsed = parseContract(quoteDecisionInputSchema, input);
    if (!parsed.success) throw new BadRequestException(parsed.message);
    const now = Date.now();
    const decidedAt = parsed.data.decidedAt ?? new Date(now).toISOString();
    if (Date.parse(decidedAt) > now + 5 * 60_000) {
      throw new BadRequestException("decidedAt cannot be in the future");
    }

    const result = await this.database.decideQuote({
      quoteId: quote.id,
      versionNumber: parsed.data.versionNumber,
      decision: parsed.data.decision,
      clientSignatory: parsed.data.clientSignatory,
      decidedAt,
      note: parsed.data.note,
      recordedBy,
      year: new Date(now).getUTCFullYear(),
    });
    if (result === "version_not_found") {
      throw new NotFoundException("That version was not found on this quote");
    }
    if (result === "not_issued") {
      throw new ConflictException("Only an issued version can be decided");
    }
    if (result === "not_latest") {
      throw new ConflictException(
        "Only the latest issued version can be accepted or rejected",
      );
    }
    if (result === "already_decided") {
      throw new ConflictException(
        "That version already has a different recorded decision",
      );
    }
    return result;
  }

  private requireNotAccepted(quote: QuoteRecord): void {
    if (quote.decisions.some((item) => item.decision === "accepted")) {
      throw new ConflictException(
        "This quote was accepted and can no longer be revised",
      );
    }
  }
}
