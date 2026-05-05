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
  // Gulf & Arab
  { code: "OMR", name: "Omani Rial", symbol: "ر.ع.", decimals: 3, rate: 1 },
  { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", decimals: 2, rate: 9.75 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimals: 2, rate: 9.55 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك", decimals: 3, rate: 0.8 },
  { code: "QAR", name: "Qatari Riyal", symbol: "ر.ق", decimals: 2, rate: 9.45 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "د.ب", decimals: 3, rate: 0.98 },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.أ", decimals: 3, rate: 1.84 },
  { code: "EGP", name: "Egyptian Pound", symbol: "ج.م", decimals: 2, rate: 128 },
  { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل", decimals: 0, rate: 232000 },
  { code: "SYP", name: "Syrian Pound", symbol: "ل.س", decimals: 0, rate: 33000 },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د", decimals: 0, rate: 3400 },
  { code: "YER", name: "Yemeni Rial", symbol: "﷼", decimals: 0, rate: 650 },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م", decimals: 2, rate: 26 },
  { code: "DZD", name: "Algerian Dinar", symbol: "د.ج", decimals: 2, rate: 350 },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت", decimals: 3, rate: 8.1 },
  { code: "LYD", name: "Libyan Dinar", symbol: "ل.د", decimals: 3, rate: 12.5 },
  { code: "SDG", name: "Sudanese Pound", symbol: "ج.س", decimals: 2, rate: 1560 },
  { code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM", decimals: 2, rate: 103 },
  // Major
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, rate: 2.6 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, rate: 2.4 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, rate: 2.05 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2, rate: 2.3 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0, rate: 390 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2, rate: 18.8 },
  { code: "KRW", name: "Korean Won", symbol: "₩", decimals: 0, rate: 3550 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2, rate: 20.2 },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", decimals: 2, rate: 83 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2, rate: 3.5 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2, rate: 3.55 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2, rate: 3.95 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2, rate: 4.35 },
  // Asia
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2, rate: 220 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", decimals: 2, rate: 725 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", decimals: 2, rate: 310 },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", decimals: 2, rate: 780 },
  { code: "NPR", name: "Nepalese Rupee", symbol: "रू", decimals: 2, rate: 350 },
  { code: "AFN", name: "Afghan Afghani", symbol: "؋", decimals: 2, rate: 180 },
  { code: "IRR", name: "Iranian Rial", symbol: "﷼", decimals: 0, rate: 109000 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2, rate: 12.2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 2, rate: 41000 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2, rate: 150 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2, rate: 90 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0, rate: 65000 },
  { code: "MMK", name: "Myanmar Kyat", symbol: "K", decimals: 0, rate: 5500 },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛", decimals: 0, rate: 10500 },
  { code: "LAK", name: "Lao Kip", symbol: "₭", decimals: 0, rate: 56000 },
  { code: "MNT", name: "Mongolian Tögrög", symbol: "₮", decimals: 0, rate: 8800 },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸", decimals: 2, rate: 1300 },
  { code: "UZS", name: "Uzbek Som", symbol: "сўм", decimals: 0, rate: 33000 },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼", decimals: 2, rate: 4.4 },
  { code: "GEL", name: "Georgian Lari", symbol: "₾", decimals: 2, rate: 7.1 },
  { code: "AMD", name: "Armenian Dram", symbol: "֏", decimals: 0, rate: 1030 },
  // Europe
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2, rate: 90 },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", decimals: 2, rate: 240 },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴", decimals: 2, rate: 108 },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", decimals: 2, rate: 10.4 },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimals: 2, rate: 60 },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimals: 0, rate: 940 },
  { code: "RON", name: "Romanian Leu", symbol: "lei", decimals: 2, rate: 12 },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв", decimals: 2, rate: 4.7 },
  { code: "RSD", name: "Serbian Dinar", symbol: "дин", decimals: 2, rate: 280 },
  { code: "HRK", name: "Croatian Kuna", symbol: "kn", decimals: 2, rate: 18 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimals: 2, rate: 27 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimals: 2, rate: 28 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", decimals: 2, rate: 18 },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr", decimals: 0, rate: 360 },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", decimals: 2, rate: 9.6 },
  // Africa
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2, rate: 47 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimals: 2, rate: 4100 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2, rate: 335 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", decimals: 2, rate: 40 },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimals: 2, rate: 320 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimals: 0, rate: 6700 },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimals: 0, rate: 9700 },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", decimals: 0, rate: 3600 },
  { code: "XOF", name: "West African CFA", symbol: "CFA", decimals: 0, rate: 1570 },
  { code: "XAF", name: "Central African CFA", symbol: "FCFA", decimals: 0, rate: 1570 },
  // Americas
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", decimals: 2, rate: 53 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2, rate: 14.7 },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$", decimals: 2, rate: 2700 },
  { code: "CLP", name: "Chilean Peso", symbol: "CLP$", decimals: 0, rate: 2500 },
  { code: "COP", name: "Colombian Peso", symbol: "COL$", decimals: 0, rate: 11000 },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/", decimals: 2, rate: 9.7 },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$U", decimals: 2, rate: 110 },
  { code: "VES", name: "Venezuelan Bolívar", symbol: "Bs", decimals: 2, rate: 200 },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$", decimals: 2, rate: 156 },
  // Crypto
  { code: "BTC", name: "Bitcoin", symbol: "₿", decimals: 8, rate: 0.000026 },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", decimals: 6, rate: 0.0008 },
  { code: "USDT", name: "Tether USDT", symbol: "₮", decimals: 2, rate: 2.6 },
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
