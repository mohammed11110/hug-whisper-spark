import { getPaddleEnvironment } from "@/lib/paddle";
import { useI18n } from "@/lib/i18n";

export function PaymentTestModeBanner() {
  const { lang } = useI18n();
  if (getPaddleEnvironment() !== "sandbox") return null;
  const ar = lang === "ar";
  return (
    <div className="w-full bg-terracotta/10 border-b border-terracotta/30 px-4 py-2 text-center text-xs text-terracotta">
      {ar ? "جميع المدفوعات في وضع التجربة (لن يتم خصم أي مبلغ حقيقي). " : "All payments in the preview are in test mode. "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-bold"
      >
        {ar ? "اعرف المزيد" : "Read more"}
      </a>
    </div>
  );
}
