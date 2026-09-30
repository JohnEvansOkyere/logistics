import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENT_STORAGE = Symbol("DOCUMENT_STORAGE");
export const DOCUMENT_BUCKET = "job-documents";
export const SIGNED_URL_SECONDS = 60;

/** Private object storage for job documents; only the API talks to it. */
export interface DocumentStorage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  createSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** The stored bytes, for reading the document's text on the server. */
  get(key: string): Promise<Buffer>;
}

@Injectable()
export class SupabaseDocumentStorage implements DocumentStorage {
  private client: SupabaseClient | undefined;

  private storage() {
    if (!this.client) {
      const url = (
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
      )?.trim();
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!url || !serviceRoleKey) {
        throw new ServiceUnavailableException(
          "Document storage is not configured",
        );
      }
      this.client = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return this.client.storage.from(DOCUMENT_BUCKET);
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const { error } = await this.storage().upload(key, bytes, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw new ServiceUnavailableException("The document could not be stored");
    }
  }

  async get(key: string): Promise<Buffer> {
    const { data, error } = await this.storage().download(key);
    if (error || !data) {
      throw new ServiceUnavailableException("The document could not be read");
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.storage().createSignedUrl(
      key,
      expiresInSeconds,
    );
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException(
        "A download link could not be created",
      );
    }
    return data.signedUrl;
  }
}
