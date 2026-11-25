// Personal data that a description of a custom task must not carry (docs/SPEC.md, section 14).
// The page shows the finds before anything is sent; the server runs the same check, so a
// request that skips the page is refused before it is stored or reaches the model.
// Names of people and companies cannot be recognised reliably: for those only the warning helps.

export type SensitiveFind = { kind: string; text: string; blocking: boolean };

// A Czech birth number without a slash: ten digits, a valid month (women +50, extra series
// +20) and divisible by 11. Telling it apart from other ten-digit numbers keeps false alarms low.
function looksLikeBirthNumber(digits: string): boolean {
  const month = Number(digits.slice(2, 4)) % 50;
  const validMonth = (month >= 1 && month <= 12) || (month >= 21 && month <= 32);
  return validMonth && BigInt(digits) % 11n === 0n;
}

const checks: { kind: string; pattern: RegExp; blocking: boolean; accept?: (match: string) => boolean }[] = [
  // The lookbehind starts a match only at the start of a name: without it, a long run of name
  // characters with no "@" took time growing with the square of its length.
  { kind: "e-mail", pattern: /(?<![\w.+-])[\w.+-]+@[\w-]+(\.[\w-]+)+/g, blocking: true },
  { kind: "IBAN", pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}\b/g, blocking: true },
  // 123456/7890 or 19-123456789/0800: a birth number or a Czech account number.
  { kind: "rodné číslo nebo číslo účtu", pattern: /\b(?:\d{1,6}-)?\d{6,10}\/\d{3,4}\b/g, blocking: true },
  { kind: "rodné číslo", pattern: /\b\d{10}\b/g, blocking: true, accept: looksLikeBirthNumber },
  // Only a warning: a nine-digit order or product number looks the same.
  { kind: "telefon", pattern: /(?:\+\d{3} ?)?\b\d{3} ?\d{3} ?\d{3}\b/g, blocking: false },
];

export function findSensitiveData(text: string): SensitiveFind[] {
  const finds: SensitiveFind[] = [];
  const taken: [number, number][] = [];
  for (const { kind, pattern, blocking, accept } of checks) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      // A number already reported as an account is not reported again as a phone.
      if (taken.some(([from, to]) => start < to && end > from)) continue;
      if (accept && !accept(match[0])) continue;
      taken.push([start, end]);
      finds.push({ kind, text: match[0], blocking });
    }
  }
  return finds;
}

export const hasBlockingData = (text: string) => findSensitiveData(text).some((find) => find.blocking);
