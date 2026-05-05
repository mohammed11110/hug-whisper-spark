import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  /** rate from OMR (1 OMR = rate units of this currency) */
  rate: number;
}

export const CURRENCIES: Currency[] = [
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", decimals: 3, rate: 1 },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", decimals: 2, rate: 9.75 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimals: 2, rate: 9.55 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", decimals: 3, rate: 0.8 },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", decimals: 2, rate: 9.45 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "د.ب", decimals: 3, rate: 0.98 },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.أ", decimals: 3, rate: 1.84 },
  { code: "EGP", name: "Egyptian Pound", symbol: "ج.م", decimals: 2, rate: 128 },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, rate: 2.6 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, rate: 2.4 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, rate: 2.05 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2, rate: 90 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2, rate: 18.8 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2, rate: 220 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimals: 2, rate: 310 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimals: 2, rate: 725 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2, rate: 12.2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 2, rate: 41000 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2, rate: 150 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2, rate: 90 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2, rate: 3.5 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0, rate: 390 },
  { code: "KRW", name: "Korean Won", symbol: "₩", decimals: 0, rate: 3550 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2, rate: 3.55 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, rate: 3.95 },
];

interface CurrencyCtx {
  currency: Currency;
  setCurrency: (code: string) => void;
  format: (amountOMR: number) => string;
}

const Ctx = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(() => localStorage.getItem("amlaki_currency") || "OMR");
  const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

  useEffect(() => {
    localStorage.setItem("amlaki_currency", code);
  }, [code]);

  const format = (amountOMR: number) => {
    const v = amountOMR * currency.rate;
    return `${v.toLocaleString(undefined, { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })} ${currency.symbol}`;
  };

  return <Ctx.Provider value={{ currency, setCurrency: setCode, format }}>{children}</Ctx.Provider>;
}

export const useCurrency = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCurrency must be inside CurrencyProvider");
  return v;
};
