import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
  documentUploadFieldsSchema,
  isUuid,
  parseContract,
} from "@bjh/contracts";
import {
  DatabasePort,
  DocumentRecord,
  JobScope,
} from "../database/database.port";
import { JobsService } from "../jobs/jobs.service";
import { DOCUMENT_STORAGE, SIGNED_URL_SECONDS } from "./document-storage.port";
import type { DocumentStorage } from "./document-storage.port";
import { detectContentType, sanitizeFilename } from "./file-signature";

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DatabasePort) private readonly database: DatabasePort,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  async list(id: string, scope: JobScope): Promise<DocumentRecord[]> {
    const job = await this.jobs.get(id, scope);
    return this.database.listDocuments(job.id);
  }

  /** Stores the file privately under a random key and records a new version. */
  async upload(
    id: string,
    fields: unknown,
    file: UploadedFile | undefined,
    uploadedBy: string,
    scope: JobScope,
  ): Promise<DocumentRecord> {
    const job = await this.jobs.get(id, scope);
    const parsed = parseContract(documentUploadFieldsSchema, fields ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.message);
    if (!file || file.size === 0) {
      throw new BadRequestException("A non-empty file is required");
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new PayloadTooLargeException("Files can be at most 25 MB");
    }
    const contentType = detectContentType(file.buffer);
    if (!contentType) {
      throw new UnsupportedMediaTypeException(
        "Only PDF, PNG and JPEG files are accepted",
      );
    }

    const objectKey = `${job.id}/${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer, contentType);
    const saved = await this.database.saveDocumentVersion({
      jobId: job.id,
      documentId: parsed.data.documentId,
      documentType: parsed.data.documentType,
      filename: sanitizeFilename(file.originalname),
      contentType,
      sizeBytes: file.size,
      sha256: createHash("sha256").update(file.buffer).digest("hex"),
      objectKey,
      uploadedBy,
    });
    if (saved === "document_not_found") {
      throw new NotFoundException("Document was not found on this job");
    }
    return saved;
  }

  /** Returns a short-lived signed link after the caller's access to the job is checked. */
  async createDownloadLink(
    id: string,
    documentId: string,
    version: string | undefined,
    scope: JobScope,
  ) {
    const job = await this.jobs.get(id, scope);
    const versionNumber = version === undefined ? undefined : Number(version);
    if (
      versionNumber !== undefined &&
      (!Number.isInteger(versionNumber) || versionNumber < 1)
    ) {
      throw new BadRequestException("version must be a positive integer");
    }
    const stored = isUuid(documentId)
      ? await this.database.findDocumentVersion(
          job.id,
          documentId,
          versionNumber,
        )
      : null;
    if (!stored) throw new NotFoundException("Document was not found");
    return {
      url: await this.storage.createSignedUrl(
        stored.objectKey,
        SIGNED_URL_SECONDS,
      ),
      expiresInSeconds: SIGNED_URL_SECONDS,
      filename: stored.filename,
      contentType: stored.contentType,
      versionNumber: stored.versionNumber,
    };
  }
}
