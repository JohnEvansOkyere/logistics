import PDFDocument from "pdfkit";
import { isValidContainerNumber } from "../src/documents/document-extraction";

/** A container number with the right ISO 6346 check digit, for a synthetic prefix. */
export function containerWithCheckDigit(prefix10: string): string {
  for (let digit = 0; digit <= 9; digit += 1) {
    const candidate = `${prefix10}${digit}`;
    if (isValidContainerNumber(candidate)) return candidate;
  }
  throw new Error("no check digit found");
}

export function pdfWithText(lines: string[]): Promise<Buffer> {
  const doc = new PDFDocument({ compress: false });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );
  for (const line of lines) doc.text(line);
  if (lines.length === 0) doc.rect(10, 10, 50, 50).stroke();
  doc.end();
  return done;
}
