import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { DEFAULT_TEMPLATES } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";

export interface StatusColor { bg: string; fg: string }
export type PageSize = "A4" | "A5" | "Letter";
export const PAGE_SIZES_MM: Record<PageSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 216, h: 279 },
};
export interface Margins { top: number; right: number; bottom: number; left: number }
export interface MessageTemplates { reminder: string; late: string; receipt: string }
export interface BusinessBrand { name: string; logo: string | null; phone: string; address: string; landlordName?: string; landlordNameEn?: string }
export interface ReceiptNumbering {
  prefix: string;
  startNumber: number;
  padding: number;
  nextNumber: number;
}
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
  /** Receipt numbering preferences */
  receipt: ReceiptNumbering;
  /** Auto-open WhatsApp after a payment is registered */
  autoSendReceiptWhatsApp: boolean;
}


export function formatReceipt(r: ReceiptNumbering, n?: number): string {
  const num = n ?? r.nextNumber ?? r.startNumber ?? 1;
  const base = r.padding > 0 ? String(num).padStart(r.padding, "0") : String(num);
  // Always prefix a leading zero before the numeric part (e.g. 1000 → 01000)
  const padded = base.startsWith("0") ? base : `0${base}`;
  return `${r.prefix || ""}${padded}`;
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
  brand: { name: "أملاكي · Amlaki", logo: null, phone: "", address: "", landlordName: "", landlordNameEn: "" },
  showAiFab: false,
  receipt: { prefix: "R-", startNumber: 1, padding: 0, nextNumber: 1 },
};

const KEY = "amlaki.appSettings.v1";

interface Ctx {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  setStatusColor: (k: keyof AppSettings["statusColors"], c: StatusColor) => void;
  reset: () => void;
  /** @deprecated Server allocates atomically on insert; kept as no-op for backwards compat. */
  bumpReceiptNumber: (delta?: number) => void;
  /** Reset server-side counter back to startNumber. */
  resetReceiptNumber: () => Promise<void>;
  /** Persist prefix / padding / startNumber on the server. */
  saveReceiptSettings: (patch: Partial<Pick<ReceiptNumbering, "prefix" | "padding" | "startNumber">>) => Promise<void>;
  /** Re-read counter from server (call after any external change). */
  refreshReceiptCounter: () => Promise<void>;
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
        receipt: { ...DEFAULTS.receipt, ...(v.receipt || {}) },
      };
    } catch { return DEFAULTS; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(settings)); }, [settings]);

  // ---- Server-synced receipt counter ----
  const applyReceiptFromServer = useCallback((row: any) => {
    if (!row) return;
    setSettings((s) => ({
      ...s,
      receipt: {
        prefix: row.prefix ?? s.receipt.prefix,
        padding: Number(row.padding ?? s.receipt.padding ?? 0),
        startNumber: Number(row.start_number ?? s.receipt.startNumber ?? 1),
        nextNumber: Number(row.next_number ?? s.receipt.nextNumber ?? 1),
      },
    }));
  }, []);

  const refreshReceiptCounter = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from("receipt_counters")
      .select("prefix, padding, start_number, next_number")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) return;
    if (data) { applyReceiptFromServer(data); return; }

    // First time ever for this user → seed from any pre-existing receipts.
    try {
      const { data: pays } = await supabase
        .from("payments")
        .select("receipt_number")
        .not("receipt_number", "is", null)
        .limit(2000);
      let maxNum = 0;
      (pays || []).forEach((p: any) => {
        const base = String(p.receipt_number || "").split("/")[0];
        const m = base.match(/(\d+)$/);
        if (m) { const n = parseInt(m[1], 10); if (n > maxNum) maxNum = n; }
      });
      const seed = maxNum + 1;
      await supabase.rpc("seed_receipt_counter", { _seed: seed });
      const { data: data2 } = await supabase
        .from("receipt_counters")
        .select("prefix, padding, start_number, next_number")
        .eq("user_id", uid)
        .maybeSingle();
      if (data2) applyReceiptFromServer(data2);
    } catch { /* swallow — non-fatal */ }
  }, [applyReceiptFromServer]);

  useEffect(() => {
    refreshReceiptCounter();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) refreshReceiptCounter();
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [refreshReceiptCounter]);

  const update = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const setStatusColor: Ctx["setStatusColor"] = (k, c) =>
    setSettings((s) => ({ ...s, statusColors: { ...s.statusColors, [k]: c } }));
  const reset = () => setSettings(DEFAULTS);

  // Server allocates atomically at insert time — local bump is no longer needed.
  const bumpReceiptNumber = (_delta: number = 1) => { /* no-op */ void _delta; };

  const resetReceiptNumber = async () => {
    const { data, error } = await supabase.rpc("update_receipt_settings", {
      _prefix: null, _padding: null, _start_number: null, _reset: true,
    });
    if (error) return;
    applyReceiptFromServer(Array.isArray(data) ? data[0] : data);
  };

  const saveReceiptSettings: Ctx["saveReceiptSettings"] = async (patch) => {
    const { data, error } = await supabase.rpc("update_receipt_settings", {
      _prefix: patch.prefix ?? null,
      _padding: patch.padding ?? null,
      _start_number: patch.startNumber ?? null,
      _reset: false,
    });
    if (error) return;
    applyReceiptFromServer(Array.isArray(data) ? data[0] : data);
  };

  return <C.Provider value={{ settings, update, setStatusColor, reset, bumpReceiptNumber, resetReceiptNumber, saveReceiptSettings, refreshReceiptCounter }}>{children}</C.Provider>;
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
