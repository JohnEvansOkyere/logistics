/**
 * A Ghana-first phone normaliser for SMS: "0244058592", "024 405 8592",
 * "233244058592", "00233244058592" and "+233 24 405 8592" all become
 * "+233244058592". Other international numbers must start with "+" or "00".
 * Returns null when the number cannot be a valid mobile number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  let international: string;
  if (trimmed.startsWith("+")) international = digits;
  else if (digits.startsWith("00")) international = digits.slice(2);
  else if (digits.startsWith("233")) international = digits;
  else if (digits.startsWith("0")) international = `233${digits.slice(1)}`;
  else return null;
  if (international.startsWith("233") && international.length !== 12) {
    return null;
  }
  return international.length >= 8 && international.length <= 15
    ? `+${international}`
    : null;
}
