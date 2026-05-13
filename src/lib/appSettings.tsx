import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp";

export interface StatusColor { bg: string; fg: string }
export type PageSize = "A4" | "A5" | "Letter";
export const PAGE_SIZES_MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 216, h: 279 },
};
export interface Margins { top: number; right: number; bottom: number; left: number }
export interface MessageTemplates { reminder: string; late: string; receipt: string }
export interface BusinessBrand { name: string; logo: string | null; phone: string; address: string }
export interface AppSettings {
  statusColors: { paid: StatusColor; late: StatusColor; soon: StatusColor };
  filterRetentionMin: number;
  pageSize: PageSize;
  marginMm?: number;
  margins: Margins;
  deletePin: string | null;
  templates: MessageTemplates;
  upcomingDays: number;
  contractWarnDays: number;
  /** Business branding for receipts & contracts */
  brand: BusinessBrand;
  /** Show the floating AI assistant button on the dashboard */
  showAiFab: boolean;
}

const DEFAULTS: AppSettings = {
  statusColors: {
    paid: { bg: "#dcebd2", fg: "#3a6b3a" },
    late: { bg: "#f3d7d7", fg: "#8a2a2a" },
    soon: { bg: "#f5e3cf", fg: "#8a5a2a" },
  },
  filterRetentionMin: -1,
  pageSize: "A4",
  margins: { top: 16, right: 16, bottom: 16, left: 16 },
  deletePin: null,
  templates: { ...DEFAULT_TEMPLATES },
  upcomingDays: 7,
  contractWarnDays: 30,
  brand: { name: "أملاكي · Amlaki", logo: null, phone: "", address: "" },
  showAiFab: false,
};

const KEY = "amlaki.appSettings.v1";

interface Ctx {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  setStatusColor: (k: keyof AppSettings["statusColors"], c: StatusColor) => void;
  reset: () => void;
}

const C = createContext<Ctx | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULTS;
      const v = JSON.parse(raw);
      const legacy = typeof v.marginMm === "number"
        ? { top: v.marginMm, right: v.marginMm, bottom: v.marginMm, left: v.marginMm }
        : null;
      return {
        ...DEFAULTS,
        ...v,
        statusColors: { ...DEFAULTS.statusColors, ...(v.statusColors || {}) },
        margins: { ...DEFAULTS.margins, ...(legacy || {}), ...(v.margins || {}) },
        templates: { ...DEFAULTS.templates, ...(v.templates || {}) },
        brand: { ...DEFAULTS.brand, ...(v.brand || {}) },
      };
    } catch { return DEFAULTS; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(settings)); }, [settings]);

  const update = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const setStatusColor: Ctx["setStatusColor"] = (k, c) =>
    setSettings((s) => ({ ...s, statusColors: { ...s.statusColors, [k]: c } }));
  const reset = () => setSettings(DEFAULTS);

  return <C.Provider value={{ settings, update, setStatusColor, reset }}>{children}</C.Provider>;
}

export const useAppSettings = () => {
  const v = useContext(C);
  if (!v) throw new Error("useAppSettings must be inside AppSettingsProvider");
  return v;
};

/** Helper: load/save a filter object with TTL based on settings */
export function readFilters<T>(key: string, fallback: T, retentionMin: number): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    if (retentionMin === 0) return fallback;
    if (retentionMin > 0 && v.t && Date.now() - v.t > retentionMin * 60_000) return fallback;
    return { ...fallback, ...(v.data || v) };
  } catch { return fallback; }
}
export function writeFilters(key: string, data: unknown, retentionMin: number) {
  if (retentionMin === 0) { localStorage.removeItem(key); return; }
  localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
}
