import { toast } from "sonner";

/**
 * Friendly toast wrapper. Use these instead of raw `toast.success/error`
 * so we keep messaging human and brand-styled (sage success / burgundy error).
 */
export const notify = {
  success(message: string, description?: string) {
    return toast.success(message, {
      description,
      style: {
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        border: "1px solid hsl(var(--primary) / 0.35)",
      },
    });
  },
  error(message: string, description?: string) {
    return toast.error(message, {
      description,
      style: {
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        border: "1px solid hsl(var(--destructive) / 0.45)",
      },
    });
  },
  info(message: string, description?: string) {
    return toast(message, { description });
  },
};

/** Map a raw thrown error to a human, bilingual message. */
export function humanizeError(e: unknown, lang: "ar" | "en" = "ar"): string {
  const raw = (e as any)?.message?.toString?.() || String(e || "");
  const lower = raw.toLowerCase();

  if (!raw) return lang === "ar" ? "حدث خطأ غير متوقع" : "Something went wrong";
  if (lower.includes("network") || lower.includes("fetch"))
    return lang === "ar" ? "تعذّر الاتصال بالشبكة" : "Network connection failed";
  if (lower.includes("timeout"))
    return lang === "ar" ? "انتهت مهلة الطلب — حاول مجدّداً" : "Request timed out — please retry";
  if (lower.includes("permission") || lower.includes("not allowed") || lower.includes("rls"))
    return lang === "ar" ? "لا تملك الصلاحية لهذا الإجراء" : "You don't have permission for this action";
  if (lower.includes("unit_quota_exceeded"))
    return lang === "ar" ? "تجاوزت عدد الوحدات المسموح به — قم بترقية الباقة" : "Unit quota exceeded — please upgrade";
  if (lower.includes("booking_overlap"))
    return lang === "ar" ? "هناك حجز آخر يتعارض مع هذه الفترة" : "Another booking overlaps these dates";
  if (lower.includes("duplicate") || lower.includes("unique"))
    return lang === "ar" ? "هذا السجل موجود مسبقاً" : "This record already exists";
  if (lower.includes("invalid login") || lower.includes("invalid credentials"))
    return lang === "ar" ? "بيانات الدخول غير صحيحة" : "Invalid login credentials";
  return lang === "ar" ? "حدث خطأ — حاول مرة أخرى" : "Something went wrong — please try again";
}
