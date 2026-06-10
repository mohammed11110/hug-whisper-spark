/**
 * Convert numeric amounts to words in Arabic and English.
 * Supports currencies with 3-decimal fractional units (OMR/BHD/KWD → بيسة/فلس),
 * with sensible fallback for 2-decimal currencies (SAR/AED/USD → halala/cents).
 */

const CURRENCY_AR: Record<string, { major: string; majorPlural: string; minor: string; minorPlural: string; fraction: 1000 | 100 }> = {
  OMR: { major: "ريالاً عُمانياً", majorPlural: "ريالاً عُمانياً", minor: "بيسة", minorPlural: "بيسة", fraction: 1000 },
  BHD: { major: "ديناراً بحرينياً", majorPlural: "ديناراً بحرينياً", minor: "فلساً", minorPlural: "فلساً", fraction: 1000 },
  KWD: { major: "ديناراً كويتياً", majorPlural: "ديناراً كويتياً", minor: "فلساً", minorPlural: "فلساً", fraction: 1000 },
  SAR: { major: "ريالاً سعودياً", majorPlural: "ريالاً سعودياً", minor: "هللة", minorPlural: "هللة", fraction: 100 },
  AED: { major: "درهماً إماراتياً", majorPlural: "درهماً إماراتياً", minor: "فلساً", minorPlural: "فلساً", fraction: 100 },
  USD: { major: "دولاراً", majorPlural: "دولاراً", minor: "سنتاً", minorPlural: "سنتاً", fraction: 100 },
};

const CURRENCY_EN: Record<string, { major: string; minor: string; fraction: 1000 | 100 }> = {
  OMR: { major: "Omani Rial", minor: "Baisa", fraction: 1000 },
  BHD: { major: "Bahraini Dinar", minor: "Fils", fraction: 1000 },
  KWD: { major: "Kuwaiti Dinar", minor: "Fils", fraction: 1000 },
  SAR: { major: "Saudi Riyal", minor: "Halala", fraction: 100 },
  AED: { major: "UAE Dirham", minor: "Fils", fraction: 100 },
  USD: { major: "US Dollar", minor: "Cent", fraction: 100 },
};

// ---------- Arabic ----------
const AR_ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const AR_TEENS = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function arUnder1000(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(AR_HUNDREDS[h]);
  if (rest) {
    if (rest < 10) parts.push(AR_ONES[rest]);
    else if (rest < 20) parts.push(AR_TEENS[rest - 10]);
    else {
      const o = rest % 10;
      const t = Math.floor(rest / 10);
      if (o) parts.push(`${AR_ONES[o]} و${AR_TENS[t]}`);
      else parts.push(AR_TENS[t]);
    }
  }
  return parts.join(" و");
}

function arInteger(n: number): string {
  if (n === 0) return "صفر";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions <= 10) parts.push(`${arUnder1000(millions)} ملايين`);
    else parts.push(`${arUnder1000(millions)} مليوناً`);
  }
  if (thousands) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands <= 10) parts.push(`${arUnder1000(thousands)} آلاف`);
    else parts.push(`${arUnder1000(thousands)} ألفاً`);
  }
  if (rest) parts.push(arUnder1000(rest));
  return parts.join(" و");
}

export function amountToWordsAr(amount: number, currency = "OMR"): string {
  const cur = CURRENCY_AR[currency.toUpperCase()] ?? CURRENCY_AR.OMR;
  const safe = Math.max(0, Number(amount) || 0);
  const major = Math.floor(safe);
  const minor = Math.round((safe - major) * cur.fraction);
  const majorTxt = `${arInteger(major)} ${cur.majorPlural}`;
  if (minor === 0) return `${majorTxt} لا غير.`;
  return `${majorTxt} و${arInteger(minor)} ${cur.minorPlural} لا غير.`;
}

// ---------- English ----------
const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const EN_TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enUnder1000(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (rest) {
    if (parts.length) parts.push("and");
    if (rest < 10) parts.push(EN_ONES[rest]);
    else if (rest < 20) parts.push(EN_TEENS[rest - 10]);
    else {
      const o = rest % 10;
      const t = Math.floor(rest / 10);
      parts.push(o ? `${EN_TENS[t]}-${EN_ONES[o]}` : EN_TENS[t]);
    }
  }
  return parts.join(" ");
}

function enInteger(n: number): string {
  if (n === 0) return "zero";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(`${enUnder1000(millions)} million`);
  if (thousands) parts.push(`${enUnder1000(thousands)} thousand`);
  if (rest) parts.push(enUnder1000(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function amountToWordsEn(amount: number, currency = "OMR"): string {
  const cur = CURRENCY_EN[currency.toUpperCase()] ?? CURRENCY_EN.OMR;
  const safe = Math.max(0, Number(amount) || 0);
  const major = Math.floor(safe);
  const minor = Math.round((safe - major) * cur.fraction);
  const majorTxt = `${enInteger(major)} ${cur.major}${major === 1 ? "" : "s"}`;
  if (minor === 0) return `${capitalize(majorTxt)} only.`;
  return `${capitalize(majorTxt)} and ${enInteger(minor)} ${cur.minor}${minor === 1 ? "" : "s"} only.`;
}
