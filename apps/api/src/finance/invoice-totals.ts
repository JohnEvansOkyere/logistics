import type {
  InvoiceLineRecord,
  InvoiceTotals,
} from "../database/database.port";

/** n / d rounded half up, for non-negative BigInt values. */
function roundedDivide(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

/**
 * Subtotal, tax lines and total in minor units, integer arithmetic only.
 * Every tax line is a percentage of the same taxable amount (levies are not
 * compounded), matching the port invoice in the client's samples. Each line
 * amount is rounded for display, but the total takes the tax once from the
 * combined rate, so a printed line may differ from the total by one minor unit
 * exactly as on that sample (NHIL 59.95 + GETFL 59.95 + VAT 359.67 on 2,397.80
 * gives 2,877.36).
 */
export function computeInvoiceTotals(
  lines: Pick<InvoiceLineRecord, "amountMinor" | "taxable">[],
  taxLines: { name: string; rateBasisPoints: number }[],
): InvoiceTotals {
  const subtotal = lines.reduce(
    (sum, line) => sum + BigInt(line.amountMinor),
    0n,
  );
  const taxable = lines
    .filter((line) => line.taxable)
    .reduce((sum, line) => sum + BigInt(line.amountMinor), 0n);
  const combinedRate = taxLines.reduce(
    (sum, line) => sum + BigInt(line.rateBasisPoints),
    0n,
  );
  const taxTotal = roundedDivide(taxable * combinedRate, 10_000n);
  return {
    subtotalMinor: Number(subtotal),
    taxLines: taxLines.map((line) => ({
      name: line.name,
      rateBasisPoints: line.rateBasisPoints,
      amountMinor: Number(
        roundedDivide(taxable * BigInt(line.rateBasisPoints), 10_000n),
      ),
    })),
    taxTotalMinor: Number(taxTotal),
    totalMinor: Number(subtotal + taxTotal),
  };
}
