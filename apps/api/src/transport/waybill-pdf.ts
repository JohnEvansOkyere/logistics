import PDFDocument from "pdfkit";
import type { BusinessSettings } from "@bjh/contracts";
import type {
  DeliveryRecord,
  JobPartyRecord,
  JobRecord,
  ShipmentReferenceRecord,
} from "../database/database.port";

// Same palette as the quote PDF and the document layout preview.
const PRIMARY = "#0b3fae";
const SECONDARY = "#5c9fd6";
const INK = "#17324d";
const MUTED = "#526b7d";
const BORDER = "#d7e3ed";
const CANVAS = "#f4f8fc";

const PAGE_MARGIN = 50;

const referenceLabels: Record<ShipmentReferenceRecord["kind"], string> = {
  master_bl: "Master B/L",
  house_bl: "House B/L",
  master_awb: "MAWB",
  house_awb: "HAWB",
  booking: "Booking",
  container: "Container",
};

export interface WaybillPdfInput {
  delivery: DeliveryRecord;
  job: JobRecord;
  parties: JobPartyRecord[];
  references: ShipmentReferenceRecord[];
  /** null until the business settings are configured (D03). */
  settings: BusinessSettings | null;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(iso))
    .concat(" UTC");
}

function partyText(parties: JobPartyRecord[], role: string): string {
  const party = parties.find((item) => item.role === role);
  if (!party) return "-";
  return party.details ? `${party.name}\n${party.details}` : party.name;
}

/**
 * Delivery waybill for a road trip, laid out from the client's air waybill
 * and proof-of-delivery samples: numbered header, party boxes, cargo row, and
 * the "goods received in apparently safe and sound condition by" block. The
 * receiver block is filled in once proof of delivery is recorded, otherwise
 * left blank to be signed on the day. No road waybill sample exists yet.
 */
export function renderWaybillPdf(
  input: WaybillPdfInput,
  options: { compress?: boolean } = {},
): Promise<Buffer> {
  const { delivery, job, parties, references, settings } = input;
  const issuerName = settings?.issuer.name ?? "Issuer details not configured";

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    compress: options.compress ?? true,
    info: { Title: `Waybill ${delivery.waybillNumber}`, Author: issuerName },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = PAGE_MARGIN;
  const width = doc.page.width - PAGE_MARGIN * 2;

  // Brand block: issuer identity over a blue rule, waybill number on the right.
  doc.font("Helvetica-Bold").fontSize(16).fillColor(PRIMARY);
  doc.text(issuerName, left, PAGE_MARGIN, { width: width * 0.6 });
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  const contact = [
    settings?.issuer.address,
    [settings?.issuer.phone, settings?.issuer.email, settings?.issuer.website]
      .filter(Boolean)
      .join("  |  "),
  ].filter(Boolean);
  for (const row of contact) {
    doc.text(String(row), left, doc.y, { width: width * 0.6 });
  }
  const brandBottom = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PRIMARY);
  doc.text("DELIVERY WAYBILL", left + width * 0.6, PAGE_MARGIN, {
    width: width * 0.4,
    align: "right",
    characterSpacing: 1,
  });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(INK);
  doc.text(delivery.waybillNumber, left + width * 0.6, PAGE_MARGIN + 13, {
    width: width * 0.4,
    align: "right",
  });
  doc.y = Math.max(brandBottom, PAGE_MARGIN + 34) + 6;
  doc
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .lineWidth(2)
    .strokeColor(PRIMARY)
    .stroke();
  doc.y += 12;

  // A labelled box; height is fixed by the caller so rows line up.
  const box = (
    label: string,
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    bold = false,
  ) => {
    doc.lineWidth(0.7).strokeColor(BORDER).rect(x, y, w, h).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(label.toUpperCase(), x + 8, y + 6, {
      width: w - 16,
      characterSpacing: 0.5,
    });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
    doc.fillColor(INK).text(value, x + 8, y + 18, {
      width: w - 16,
      height: h - 22,
      ellipsis: true,
    });
  };
  const row = (
    cells: Array<[string, string]>,
    height: number,
    bold = false,
  ) => {
    const y = doc.y;
    const w = width / cells.length;
    cells.forEach(([label, value], index) => {
      box(label, value, left + index * w, y, w, height, bold);
    });
    doc.y = y + height;
  };

  row(
    [
      ["Job file", job.fileNumber],
      ["Dispatched", formatDateTime(delivery.dispatchedAt)],
      ["Customer", job.customerCompanyName],
    ],
    38,
    true,
  );
  row(
    [
      ["Shipper", partyText(parties, "shipper")],
      ["Consignee", partyText(parties, "consignee")],
    ],
    70,
  );
  const referenceText = references
    .map((item) =>
      item.sealNumber
        ? `${referenceLabels[item.kind]}: ${item.value} (seal ${item.sealNumber})`
        : `${referenceLabels[item.kind]}: ${item.value}`,
    )
    .join("   |   ");
  row([["Shipment references", referenceText || "-"]], 38);
  row(
    [
      ["Driver", `${delivery.driverName}\n${delivery.driverPhone}`],
      ["Vehicle registration", delivery.vehicleRegistration],
    ],
    54,
    true,
  );
  row(
    [
      ["Collect from", delivery.pickupLocation ?? "-"],
      ["Deliver to", delivery.deliveryAddress],
    ],
    52,
  );

  // Cargo table, as in the air waybill: packages, weight, description.
  doc.y += 12;
  const columns = [
    { title: "No. of packages", width: width * 0.18 },
    { title: "Gross weight (kg)", width: width * 0.2 },
    { title: "Description of goods", width: width * 0.62 },
  ];
  const headerY = doc.y;
  doc.rect(left, headerY, width, 20).fillAndStroke(CANVAS, BORDER);
  let x = left;
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(PRIMARY);
  for (const column of columns) {
    doc.text(column.title, x + 6, headerY + 6, { width: column.width - 12 });
    x += column.width;
  }
  const cargo = [
    delivery.packages === null ? "-" : String(delivery.packages),
    delivery.grossWeightKg === null ? "-" : String(delivery.grossWeightKg),
    delivery.cargoDescription,
  ];
  doc.font("Helvetica").fontSize(9.5);
  const cargoHeight = Math.max(
    50,
    doc.heightOfString(cargo[2], { width: columns[2].width - 12 }) + 14,
  );
  x = left;
  cargo.forEach((text, index) => {
    doc.fillColor(INK).text(text, x + 6, headerY + 28, {
      width: columns[index].width - 12,
    });
    x += columns[index].width;
  });
  doc
    .lineWidth(0.7)
    .strokeColor(BORDER)
    .rect(left, headerY + 20, width, cargoHeight)
    .stroke();
  doc.y = headerY + 20 + cargoHeight + 18;

  // Receiver block, worded as in the client's proof-of-delivery sample.
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(PRIMARY);
  doc.text(
    "GOODS RECEIVED IN APPARENTLY SAFE AND SOUND CONDITION BY:",
    left,
    doc.y,
    { width },
  );
  doc.moveDown(0.6);
  const delivered = delivery.status === "delivered";
  const fields: Array<[string, string | null]> = [
    ["Name", delivered ? delivery.receiverName : null],
    ["Telephone no.", delivered ? delivery.receiverPhone : null],
    [
      "Date and time",
      delivered && delivery.deliveredAt
        ? formatDateTime(delivery.deliveredAt)
        : null,
    ],
    ["Damage or shortage noted", delivered ? delivery.damageNotes : null],
    ["Signature", null],
  ];
  for (const [label, value] of fields) {
    const y = doc.y + 18;
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    doc.text(`${label}:`, left, y - 13, { width: 130, lineBreak: false });
    if (value) {
      doc.font("Helvetica-Bold").fillColor(INK);
      doc.text(value, left + 135, y - 13, {
        width: width - 135,
        lineBreak: false,
        ellipsis: true,
      });
    }
    doc
      .moveTo(left + 135, y)
      .lineTo(left + width, y)
      .lineWidth(0.7)
      .strokeColor(SECONDARY)
      .stroke();
    doc.y = y + 8;
  }

  // Issuer and driver signatures.
  doc.y += 26;
  const signatureTop = doc.y;
  const half = width / 2 - 12;
  [
    [`For ${issuerName}`, left],
    ["Driver", left + width / 2 + 12],
  ].forEach(([title, sx]) => {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(PRIMARY);
    doc.text(String(title), Number(sx), signatureTop, { width: half });
    const y = signatureTop + 40;
    doc
      .moveTo(Number(sx), y)
      .lineTo(Number(sx) + half, y)
      .lineWidth(0.7)
      .strokeColor(SECONDARY)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text("Name and signature", Number(sx), y + 3, { width: half });
  });

  doc.page.margins.bottom = 0;
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
  doc.text(
    `${issuerName}  |  Waybill ${delivery.waybillNumber}`,
    left,
    doc.page.height - 34,
    { width, align: "center", lineBreak: false },
  );

  doc.end();
  return done;
}
