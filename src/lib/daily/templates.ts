// Default WhatsApp message templates for daily rentals.
export const DEFAULT_DAILY_TEMPLATES: Array<{ key: string; title_ar: string; body_ar: string }> = [
  {
    key: "booking_confirmation",
    title_ar: "تأكيد الحجز",
    body_ar:
      "أهلاً {guest} 🌿\nتم تأكيد حجزك في {unit} من {check_in} إلى {check_out} ({nights} ليالٍ).\nالإجمالي: {total}\nنتطلع لاستضافتك.",
  },
  {
    key: "check_in_instructions",
    title_ar: "تعليمات الدخول",
    body_ar:
      "أهلاً {guest}،\nرمز الباب: {door_code}\nالعنوان: {address}\nموعد الدخول: من الساعة 3:00 عصراً.\nأي استفسار نحن في الخدمة.",
  },
  {
    key: "check_out_reminder",
    title_ar: "تذكير المغادرة",
    body_ar:
      "صباح الخير {guest} 🌅\nنذكّرك بموعد المغادرة اليوم {check_out} قبل الساعة 12 ظهراً.\nشكراً لاختيارك إقامتنا.",
  },
  {
    key: "review_request",
    title_ar: "طلب تقييم",
    body_ar:
      "نشكرك {guest} على إقامتك معنا 🤍\nسعدنا باستضافتك. نتمنى تقييمك يساعدنا على التطور.",
  },
];

export function fillDailyTemplate(
  body: string,
  vars: Record<string, string | number | undefined | null>,
) {
  return body.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}
