import { Catch, HttpException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";

function clientErrorStatus(exception: unknown): number | undefined {
  if (exception instanceof HttpException || typeof exception !== "object") {
    return undefined;
  }
  if ((exception as { code?: unknown }).code === "LIMIT_FILE_SIZE") return 413;
  const status = (exception as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500
    ? status
    : undefined;
}

/** Turns body-parser failures (malformed JSON, oversized body) into 4xx instead of 500. */
@Catch()
export class RequestErrorFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const status = clientErrorStatus(exception);
    if (status === undefined) {
      super.catch(exception, host);
      return;
    }
    super.catch(
      new HttpException(
        status === 413 ? "Request body is too large" : "Malformed request body",
        status,
      ),
      host,
    );
  }
}
