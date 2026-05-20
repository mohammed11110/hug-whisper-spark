import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { SEO } from "@/components/SEO";
import { useI18n } from "@/lib/i18n";


const LAST_UPDATED = "2026-05-13";
const COMPANY = "أملاكي · Amlaki1";
const SUPPORT_EMAIL = "support@amlaki.app";

export default function Terms() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="mobile-shell pb-24 bg-background min-h-screen">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/settings" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "شروط الاستخدام" : "Terms of Service"}</h1>
      </div>
      <p className="px-5 mt-1 text-[11px] text-muted-foreground">
        {ar ? `آخر تحديث: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
      </p>

      <article className="px-5 mt-5 space-y-5 text-sm leading-relaxed text-sage-600">
        {ar ? (
          <>
            <Section title="1. مقدمة">
              مرحباً بك في {COMPANY}، خدمة سحابية لإدارة العقارات والوحدات والمستأجرين والمدفوعات. باستخدامك للخدمة فإنك توافق على هذه الشروط. إذا كنت لا توافق، فيرجى عدم استخدام الخدمة.
            </Section>
            <Section title="2. الحساب والاشتراك">
              يجب أن تكون بعمر 18 سنة فأكثر، وأن تقدم بيانات صحيحة. أنت مسؤول عن سرية بيانات الدخول. الخطط المتاحة: مجانية ومدفوعة (شهرية وسنوية) بالريال السعودي. يتجدد الاشتراك تلقائياً ما لم يتم إلغاؤه قبل تاريخ التجديد.
            </Section>
            <Section title="3. الدفع والفوترة">
              تتم معالجة المدفوعات عبر Paddle (Paddle.com Market Limited) بصفته بائع التسجيل (Merchant of Record). جميع الأسعار شاملة الضرائب المطبقة. ستُظهر المعاملة باسم Paddle بجانب اسم خدمتنا في كشف بطاقتك.
            </Section>
            <Section title="4. الاستخدامات المحظورة">
              <List items={[
                "أي نشاط مخالف لأنظمة المملكة العربية السعودية",
                "محاولة اختراق أو تعطيل الخدمة أو الوصول غير المصرح به",
                "إساءة استخدام الخدمة بشكل ينتهك خصوصية الآخرين",
                "إعادة بيع أو تأجير الخدمة لأطراف ثالثة دون إذن خطي",
              ]} />
            </Section>
            <Section title="5. ملكية المحتوى">
              تحتفظ بكامل ملكية بياناتك (العقارات، المستأجرين، المدفوعات). نحن نحتفظ بحق ملكية البرنامج والعلامة التجارية. تمنحنا ترخيصاً محدوداً لمعالجة بياناتك لأغراض تشغيل الخدمة فقط.
            </Section>
            <Section title="6. إنهاء الحساب">
              يمكنك إلغاء اشتراكك في أي وقت من صفحة الإعدادات. يحق لنا تعليق أو إنهاء حسابك في حال انتهاك هذه الشروط، مع إشعارك عبر البريد الإلكتروني عند الإمكان.
            </Section>
            <Section title="7. إخلاء المسؤولية">
              تُقدَّم الخدمة "كما هي" دون ضمانات صريحة أو ضمنية. لا نضمن خلوها من الأخطاء أو الانقطاع. مسؤوليتنا الإجمالية لا تتجاوز ما دفعته خلال آخر 12 شهراً.
            </Section>
            <Section title="8. التعديلات">
              قد نحدث هذه الشروط من حين لآخر. سنشعرك بالتغييرات الجوهرية قبل سريانها بـ 14 يوماً على الأقل.
            </Section>
            <Section title="9. القانون الحاكم">
              تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص محاكم الرياض بالنظر في أي نزاع ينشأ عنها.
            </Section>
            <Section title="10. التواصل">
              لأي استفسار: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a>
            </Section>
          </>
        ) : (
          <>
            <Section title="1. Introduction">
              Welcome to {COMPANY}, a cloud-based property management service for buildings, units, tenants, and payments. By using the service you agree to these terms. If you do not agree, do not use the service.
            </Section>
            <Section title="2. Account & Subscription">
              You must be 18 or older and provide accurate information. You are responsible for keeping your credentials secure. Plans available: Free and paid (monthly/yearly) in SAR. Subscriptions renew automatically unless canceled before the renewal date.
            </Section>
            <Section title="3. Payments & Billing">
              Payments are processed by Paddle (Paddle.com Market Limited) acting as the Merchant of Record. Prices include applicable taxes. The transaction will appear as Paddle alongside our service name on your card statement.
            </Section>
            <Section title="4. Prohibited Use">
              <List items={[
                "Any activity that violates Saudi Arabian law",
                "Attempting to hack, disrupt, or gain unauthorized access to the service",
                "Misusing the service in ways that violate others' privacy",
                "Reselling or renting the service to third parties without written permission",
              ]} />
            </Section>
            <Section title="5. Content Ownership">
              You retain full ownership of your data (properties, tenants, payments). We retain ownership of the software and brand. You grant us a limited license to process your data solely to operate the service.
            </Section>
            <Section title="6. Termination">
              You may cancel your subscription anytime from the Settings page. We may suspend or terminate your account if you violate these terms, with email notice when possible.
            </Section>
            <Section title="7. Disclaimer of Warranties">
              The service is provided "as is" without express or implied warranties. We do not guarantee error-free or uninterrupted operation. Our total liability is limited to amounts paid in the last 12 months.
            </Section>
            <Section title="8. Changes">
              We may update these terms from time to time. Material changes will be notified at least 14 days before they take effect.
            </Section>
            <Section title="9. Governing Law">
              These terms are governed by the laws of the Kingdom of Saudi Arabia. Riyadh courts have jurisdiction over any disputes.
            </Section>
            <Section title="10. Contact">
              For inquiries: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a>
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
