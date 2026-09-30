import PDFDocument from "pdfkit";
import {
  transportDocumentFields,
  transportDocumentTitles,
} from "@bjh/contracts";
import type { BusinessSettings } from "@bjh/contracts";
import type {
  JobRecord,
  TransportDocumentRecord,
} from "../database/database.port";

// Same palette as the other PDFs.
const PRIMARY = "#0b3fae";
const SECONDARY = "#5c9fd6";
const INK = "#17324d";
const MUTED = "#526b7d";
const BORDER = "#d7e3ed";
const MARK_RED = "#b3261e";

const PAGE_MARGIN = 50;

/** Fields that get the full width of the page rather than half of it. */
const fullWidth = new Set([
  "containers",
  "goods",
  "shipmentLines",
  "handlingInformation",
]);

export interface TransportDocumentPdfInput {
  document: TransportDocumentRecord;
  job: JobRecord;
  /** null until the business settings are configured (D03). */
  settings: BusinessSettings | null;
}

/** Why the PDF carries a DRAFT mark, or null for an issued copy. */
export function transportDocumentDraftReason(
  input: TransportDocumentPdfInput,
): string | null {
  if (input.document.status === "draft") return "Draft - not yet issued";
  return null;
}

/**
 * A house B/L, house air waybill or air manifest, laid out from its field list:
 * issuer header and number, then the fields in their groups (two to a row,
 * wide ones across the page), and a signature line.
 */
export function renderTransportDocumentPdf(
  input: TransportDocumentPdfInput,
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const { document, job, settings } = input;
  const issuerName = settings?.issuer.name ?? "Issuer details not configured";
  const title = transportDocumentTitles[document.kind];
  const draftReason = transportDocumentDraftReason(input);

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    compress: options.compress ?? true,
    info: {
      Title: `${title} ${document.documentNumber ?? "(draft)"}`,
      Author: issuerName,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = PAGE_MARGIN;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const bottom = () => doc.page.height - PAGE_MARGIN - 20;

  // Issuer block, document type and number on the right.
  doc.font("Helvetica-Bold").fontSize(15).fillColor(PRIMARY);
  doc.text(issuerName, left, PAGE_MARGIN, { width: width * 0.55 });
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  const contact = [
    settings?.issuer.address,
    [settings?.issuer.phone, settings?.issuer.email]
      .filter(Boolean)
      .join("  |  "),
  ].filter(Boolean);
  for (const row of contact) {
    doc.text(String(row), left, doc.y, { width: width * 0.55 });
  }
  const brandBottom = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PRIMARY);
  doc.text(title.toUpperCase(), left + width * 0.5, PAGE_MARGIN, {
    width: width * 0.5,
    align: "right",
    characterSpacing: 0.6,
  });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK);
  doc.text(
    document.documentNumber ?? "Not yet numbered",
    left + width * 0.5,
    PAGE_MARGIN + 22,
    { width: width * 0.5, align: "right" },
  );
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(`Job file ${job.fileNumber}`, left + width * 0.5, PAGE_MARGIN + 42, {
    width: width * 0.5,
    align: "right",
  });
  doc.y = Math.max(brandBottom, PAGE_MARGIN + 56) + 6;
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .lineWidth(2)
    .strokeColor(PRIMARY)
    .stroke();
  doc.y += 12;

  const definitions = transportDocumentFields[document.kind];
  const groups = [...new Set(definitions.map((field) => field.group))];
  const gap = 8;
  const half = (width - gap) / 2;

  const boxHeight = (value: string, boxWidth: number) => {
    doc.font("Helvetica").fontSize(9);
    return Math.max(
      38,
      doc.heightOfString(value || " ", { width: boxWidth - 16 }) + 26,
    );
  };
  const drawBox = (
    label: string,
    value: string,
    x: number,
    y: number,
    boxWidth: number,
    height: number,
  ) => {
    doc
      .lineWidth(0.7)
      .strokeColor(BORDER)
      .rect(x, y, boxWidth, height)
      .stroke();
    doc.font("Helvetica").fontSize(7).fillColor(MUTED);
    doc.text(label.toUpperCase(), x + 8, y + 6, {
      width: boxWidth - 16,
      characterSpacing: 0.4,
      lineBreak: false,
    });
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    doc.text(value, x + 8, y + 18, { width: boxWidth - 16 });
  };

  for (const group of groups) {
    const inGroup = definitions.filter((field) => field.group === group);
    if (doc.y + 60 > bottom()) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(PRIMARY);
    doc.text(group.toUpperCase(), left, doc.y, { characterSpacing: 0.8 });
    doc.y += 4;

    let pending: (typeof inGroup)[number] | null = null;
    const flush = (
      first: (typeof inGroup)[number],
      second: (typeof inGroup)[number] | null,
    ) => {
      const a = document.fields[first.key] ?? "";
      const b = second ? (document.fields[second.key] ?? "") : "";
      const height = Math.max(
        boxHeight(a, half),
        second ? boxHeight(b, half) : 0,
      );
      if (doc.y + height > bottom()) doc.addPage();
      const y = doc.y;
      drawBox(first.label, a, left, y, second ? half : width, height);
      if (second) drawBox(second.label, b, left + half + gap, y, half, height);
      doc.y = y + height;
    };
    for (const field of inGroup) {
      if (fullWidth.has(field.key)) {
        if (pending) {
          flush(pending, null);
          pending = null;
        }
        const value = document.fields[field.key] ?? "";
        const height = boxHeight(value, width);
        if (doc.y + height > bottom()) doc.addPage();
        const y = doc.y;
        drawBox(field.label, value, left, y, width, height);
        doc.y = y + height;
      } else if (pending) {
        flush(pending, field);
        pending = null;
      } else {
        pending = field;
      }
    }
    if (pending) flush(pending, null);
    doc.y += 10;
  }

  // Signature line for the issuer.
  if (doc.y + 70 > bottom()) doc.addPage();
  doc.y += 8;
  const signatureTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(PRIMARY);
  doc.text(`For ${issuerName}`, left, signatureTop, { width: half });
  for (const [index, label] of ["Name and signature", "Date"].entries()) {
    const x = left + index * (half + gap);
    doc
      .moveTo(x, signatureTop + 36)
      .lineTo(x + half, signatureTop + 36)
      .lineWidth(0.7)
      .strokeColor(SECONDARY)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(label, x, signatureTop + 39, { width: half });
  }

  // Footer, DRAFT and VOID marks on every page.
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const { height, width: pageWidth } = doc.page;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(
      `${issuerName}  |  ${document.documentNumber ?? "Draft"}  |  Page ${index + 1} of ${range.count}`,
      left,
      height - 34,
      { width, align: "center", lineBreak: false },
    );
    const mark =
      document.status === "void" ? "VOID" : draftReason ? "DRAFT" : null;
    if (mark) {
      doc.save();
      doc.fillColor(MARK_RED).opacity(0.1);
      doc.rotate(-35, { origin: [pageWidth / 2, height / 2] });
      doc.font("Helvetica-Bold").fontSize(110);
      doc.text(mark, 0, height / 2 - 60, {
        width: pageWidth,
        align: "center",
        lineBreak: false,
      });
      doc.restore();
      doc.opacity(1).font("Helvetica-Bold").fontSize(8).fillColor(MARK_RED);
      doc.text(
        (document.status === "void"
          ? `Void - ${document.voidReason ?? ""}`
          : (draftReason ?? "")
        ).toUpperCase(),
        left,
        24,
        { width, align: "right", lineBreak: false },
      );
    }
  }

  doc.end();
  return done;
}
