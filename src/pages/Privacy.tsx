import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { SEO } from "@/components/SEO";
import { useI18n } from "@/lib/i18n";


const LAST_UPDATED = "2026-05-13";
const COMPANY = "أملاكي · Amlaki1";
const SUPPORT_EMAIL = "support@amlaki.app";
const PRIVACY_EMAIL = "privacy@amlaki.app";

export default function Privacy() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="mobile-shell pb-24 bg-background min-h-screen">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/settings" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
      </div>
      <p className="px-5 mt-1 text-[11px] text-muted-foreground">
        {ar ? `آخر تحديث: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
      </p>

      <article className="px-5 mt-5 space-y-5 text-sm leading-relaxed text-sage-600">
        {ar ? (
          <>
            <Section title="1. من نحن">
              {COMPANY} ("نحن") خدمة سحابية لإدارة العقارات. نلتزم بحماية خصوصيتك وفقاً لنظام حماية البيانات الشخصية السعودي (PDPL).
            </Section>
            <Section title="2. البيانات التي نجمعها">
              <List items={[
                "بيانات الحساب: الاسم، البريد الإلكتروني، رقم الجوال",
                "بيانات الأعمال: العقارات، الوحدات، المستأجرين، عقود الإيجار، المدفوعات",
                "بيانات الفوترة: يعالجها Paddle مباشرة (لا نحتفظ ببيانات بطاقتك)",
                "بيانات الاستخدام التقنية: عنوان IP، نوع المتصفح، أوقات الدخول",
              ]} />
            </Section>
            <Section title="3. كيف نستخدم بياناتك">
              <List items={[
                "تشغيل الخدمة وتقديم الميزات التي طلبتها",
                "معالجة المدفوعات وإصدار الفواتير",
                "الدعم الفني والإشعارات المهمة",
                "تحسين الخدمة وتطوير ميزات جديدة",
                "الالتزام بالمتطلبات القانونية",
              ]} />
            </Section>
            <Section title="4. مشاركة البيانات مع أطراف ثالثة">
              نشارك الحد الأدنى من البيانات اللازمة مع:
              <List items={[
                "Lovable Cloud / Supabase: استضافة قاعدة البيانات والملفات",
                "Paddle: معالجة المدفوعات (Merchant of Record)",
                "خدمات الذكاء الاصطناعي: عند استخدامك للمساعد الذكي (Google Gemini, OpenAI عبر Lovable AI Gateway)",
              ]} />
              لا نبيع بياناتك لأي طرف ثالث.
            </Section>
            <Section title="5. حقوقك">
              <List items={[
                "الوصول إلى بياناتك وطلب نسخة منها",
                "تصحيح البيانات غير الدقيقة",
                "حذف حسابك وبياناتك (مع مراعاة الاحتفاظ القانوني للسجلات المالية)",
                "نقل بياناتك بصيغة قابلة للقراءة (CSV/JSON)",
                "الاعتراض على معالجة معينة",
              ]} />
              لممارسة هذه الحقوق راسلنا على: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-sage-500 underline">{PRIVACY_EMAIL}</a>
            </Section>
            <Section title="6. الاحتفاظ بالبيانات">
              نحتفظ ببياناتك طوال فترة اشتراكك النشط. بعد إلغاء الحساب نحتفظ بها 90 يوماً للسماح بالاستعادة، ثم تُحذف نهائياً، باستثناء السجلات المالية التي يلزمنا الاحتفاظ بها 5 سنوات وفقاً للأنظمة.
            </Section>
            <Section title="7. الأمان">
              نستخدم تشفير TLS لنقل البيانات، Row-Level Security على مستوى قاعدة البيانات، وتشفير كلمات المرور. نراجع إعدادات الأمان دورياً.
            </Section>
            <Section title="8. ملفات تعريف الارتباط (Cookies)">
              نستخدم ملفات تعريف ارتباط أساسية فقط لإدارة الجلسة وحفظ تفضيلاتك (اللغة، السمة). لا نستخدم تتبع إعلاني.
            </Section>
            <Section title="9. تعديلات السياسة">
              قد نحدث هذه السياسة. سنعلمك بأي تغيير جوهري عبر البريد قبل 14 يوماً.
            </Section>
            <Section title="10. التواصل">
              مسؤول حماية البيانات: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-sage-500 underline">{PRIVACY_EMAIL}</a><br/>
              الدعم العام: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a>
            </Section>
          </>
        ) : (
          <>
            <Section title="1. Who We Are">
              {COMPANY} ("we") is a cloud-based property management service. We are committed to protecting your privacy in accordance with the Saudi Personal Data Protection Law (PDPL).
            </Section>
            <Section title="2. Data We Collect">
              <List items={[
                "Account data: name, email, phone number",
                "Business data: properties, units, tenants, lease contracts, payments",
                "Billing data: processed directly by Paddle (we do not store card details)",
                "Technical usage data: IP address, browser type, login times",
              ]} />
            </Section>
            <Section title="3. How We Use Your Data">
              <List items={[
                "Operate the service and provide requested features",
                "Process payments and issue invoices",
                "Technical support and important notifications",
                "Improve the service and develop new features",
                "Comply with legal requirements",
              ]} />
            </Section>
            <Section title="4. Sharing With Third Parties">
              We share the minimum necessary data with:
              <List items={[
                "Lovable Cloud / Supabase: database and file hosting",
                "Paddle: payment processing (Merchant of Record)",
                "AI services: when you use the AI assistant (Google Gemini, OpenAI via Lovable AI Gateway)",
              ]} />
              We never sell your data to third parties.
            </Section>
            <Section title="5. Your Rights">
              <List items={[
                "Access your data and request a copy",
                "Correct inaccurate data",
                "Delete your account and data (subject to legal retention of financial records)",
                "Export your data in a readable format (CSV/JSON)",
                "Object to certain processing",
              ]} />
              To exercise these rights: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-sage-500 underline">{PRIVACY_EMAIL}</a>
            </Section>
            <Section title="6. Data Retention">
              We retain your data throughout your active subscription. After cancellation we keep it for 90 days to allow restoration, then permanently delete it, except financial records which we must keep for 5 years per regulations.
            </Section>
            <Section title="7. Security">
              We use TLS encryption in transit, Row-Level Security at the database layer, and password hashing. We review security settings regularly.
            </Section>
            <Section title="8. Cookies">
              We use only essential cookies for session management and preferences (language, theme). We do not use advertising trackers.
            </Section>
            <Section title="9. Policy Changes">
              We may update this policy. We will notify you of material changes via email at least 14 days in advance.
            </Section>
            <Section title="10. Contact">
              Data Protection Officer: <a href={`mailto:${PRIVACY_EMAIL}`} className="text-sage-500 underline">{PRIVACY_EMAIL}</a><br/>
              General Support: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sage-500 underline">{SUPPORT_EMAIL}</a>
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
