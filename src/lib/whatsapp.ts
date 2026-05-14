// WhatsApp helper – opens wa.me with a pre-filled message
export function openWhatsApp(phone: string, message: string) {
  // strip non-digits, keep leading + by removing it (wa.me wants no +)
  const clean = (phone || "").replace(/[^\d]/g, "");
  if (!clean) return;
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function fillTemplate(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const DEFAULT_TEMPLATES = {
  reminder:
    "السلام عليكم {tenant}،\nنذكركم بإيجار وحدة {unit} في {building} بقيمة {amount}.\nالمتبقي عليكم: {remaining}.\nنشكر تعاونكم.",
  late:
    "السلام عليكم {tenant}،\nنود تذكيركم بأن إيجار وحدة {unit} في {building} متأخر.\nالمبلغ المتبقي: {remaining}.\nيرجى السداد في أقرب وقت.\nشكراً.",
  receipt:
    "السلام عليكم {tenant}،\nتم استلام دفعة بقيمة {amount} لوحدة {unit} في {building} بتاريخ {date}.\nالمتبقي عليكم بعد هذه الدفعة: {remaining}.\nشكراً لكم.",
};
