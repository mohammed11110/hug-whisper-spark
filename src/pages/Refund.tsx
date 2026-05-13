import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { useI18n } from "@/lib/i18n";

const LAST_UPDATED = "2026-05-13";
const COMPANY = "أملاكي · Amlaki";
const SUPPORT_EMAIL = "support@amlaki.app";

export default function Refund() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="mobile-shell pb-24 bg-background min-h-screen">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/settings" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "سياسة الاسترجاع" : "Refund Policy"}</h1>
      </div>
      <p className="px-5 mt-1 text-[11px] text-muted-foreground">
        {ar ? `آخر تحديث: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
      </p>

      <article className="px-5 mt-5 space-y-5 text-sm leading-relaxed text-sage-600">
        {ar ? (
          <>
            <Section title="1. ضمان رضا 14 يوماً">
              نقدم استرداداً كاملاً لأي اشتراك جديد خلال 14 يوماً من تاريخ أول دفعة، بدون أسئلة. هذا ينطبق على المشتركين الجدد فقط (وليس على التجديدات).
            </Section>
            <Section title="2. الاشتراكات الشهرية">
              بعد فترة الـ 14 يوماً، لا يتم استرداد المبالغ عن الأشهر الجارية. يمكنك إلغاء التجديد في أي وقت وستستمر خدمتك حتى نهاية فترة الفوترة الحالية.
            </Section>
            <Section title="3. الاشتراكات السنوية">
              <List items={[
                "خلال 14 يوماً: استرداد كامل",
                "بين 15 و 30 يوماً: استرداد نسبي (Pro-rata) عن الأشهر غير المستخدمة",
                "بعد 30 يوماً: لا استرداد، لكن لا يتم تجديد الاشتراك تلقائياً إذا ألغيته",
              ]} />
            </Section>
            <Section title="4. الاستثناءات">
              لا نقدم استرداداً في الحالات التالية:
              <List items={[
                "انتهاك شروط الاستخدام",
                "نشاط احتيالي أو سوء استخدام للخدمة",
                "طلبات استرداد لاشتراكات تم تجديدها سابقاً (التجديدات لا تخضع لضمان الـ 14 يوماً)",
              ]} />
            </Section>
            <Section title="5. كيفية طلب الاسترداد">
              أرسل طلبك عبر البريد <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a> وأرفق:
              <List items={[
                "البريد الإلكتروني المستخدم في الحساب",
                "رقم الفاتورة (موجود في رسالة Paddle)",
                "سبب الطلب (اختياري ولكنه يساعدنا في التحسين)",
              ]} />
              سنرد خلال 5 أيام عمل.
            </Section>
            <Section title="6. معالجة الاسترداد">
              عند الموافقة، يتم الاسترداد إلى نفس وسيلة الدفع الأصلية خلال 5-10 أيام عمل عبر Paddle. قد تستغرق البنوك وقتاً إضافياً لإظهار المبلغ في كشف حسابك.
            </Section>
            <Section title="7. الإلغاء بدون استرداد">
              يمكنك إلغاء اشتراكك في أي وقت من صفحة الإعدادات ← الاشتراك. ستبقى الخدمة فعّالة حتى نهاية الفترة المدفوعة، ثم يتحول الحساب إلى الخطة المجانية تلقائياً.
            </Section>
            <Section title="8. التواصل">
              لأي استفسار حول الاسترداد: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a>
            </Section>
          </>
        ) : (
          <>
            <Section title="1. 14-Day Satisfaction Guarantee">
              We offer a full refund on any new subscription within 14 days of the first payment, no questions asked. This applies to new subscribers only (not renewals).
            </Section>
            <Section title="2. Monthly Subscriptions">
              After the 14-day window, we do not refund the current month. You can cancel renewal anytime and the service will continue until the end of the current billing period.
            </Section>
            <Section title="3. Annual Subscriptions">
              <List items={[
                "Within 14 days: full refund",
                "Between 15 and 30 days: pro-rata refund for unused months",
                "After 30 days: no refund, but the subscription will not auto-renew if canceled",
              ]} />
            </Section>
            <Section title="4. Exceptions">
              We do not offer refunds in the following cases:
              <List items={[
                "Violation of the Terms of Service",
                "Fraudulent activity or misuse of the service",
                "Refund requests on previously renewed subscriptions (renewals are not covered by the 14-day guarantee)",
              ]} />
            </Section>
            <Section title="5. How to Request a Refund">
              Send your request to <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a> with:
              <List items={[
                "The email used on the account",
                "Invoice number (in your Paddle email)",
                "Reason for the request (optional but helps us improve)",
              ]} />
              We will respond within 5 business days.
            </Section>
            <Section title="6. Refund Processing">
              Once approved, the refund is issued to the original payment method within 5-10 business days via Paddle. Banks may take additional time to reflect the amount.
            </Section>
            <Section title="7. Cancellation Without Refund">
              You can cancel your subscription anytime from Settings → Subscription. The service remains active until the end of the paid period, then the account reverts to the Free plan.
            </Section>
            <Section title="8. Contact">
              For refund inquiries: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a>
            </Section>
          </>
        )}
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-black text-sage-600 text-base mb-2">{title}</h2>
      <div className="text-sage-600/90">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc ms-5 space-y-1 mt-1">
      {items.map((it) => <li key={it}>{it}</li>)}
    </ul>
  );
}
