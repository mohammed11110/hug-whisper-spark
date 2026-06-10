## Plan: Adopt the uploaded design as the Amlaki signup confirmation email

The email domain `1.amlaki1.app` is already verified, so we can scaffold and deploy auth email templates immediately.

### Steps
1. Scaffold Lovable auth email templates (creates the `auth-email-hook` and 6 React Email templates: signup, magic-link, recovery, invite, email-change, reauthentication).
2. Convert the uploaded HTML into the signup template (`_shared/email-templates/signup.tsx`) using React Email components:
   - RTL Arabic + LTR English bilingual layout
   - Navy header `#272B3A` with gold `#B8924A` logo tile and "أملاكي / A M L A K I" wordmark
   - Paper card `#FBFAF7` on `#ffffff` body background (Body bg must stay white per email rules)
   - Gold accent rule, eyebrow "تأكيد الحساب · CONFIRM ACCOUNT"
   - Heading "أهلاً بك في أملاكي / Welcome to Amlaki"
   - Bilingual paragraph
   - Bulletproof gold CTA button → `confirmationUrl`
   - Fallback raw URL in light-gold pill `#E9DFC8`
   - Bilingual security note + navy footer "فريق أملاكي · Amlaki Team / إدارة عقاراتك بذكاء"
   - Wire `siteName`, `confirmationUrl` variables
3. Apply the same brand shell (navy header + gold accent + paper card + bilingual footer) to the other 5 templates so the whole auth email family stays consistent, with their own AR/EN headings and CTAs (sign-in link, password reset, invite, email change, OTP code).
4. Deploy `auth-email-hook` edge function.
5. Provide preview buttons for signup and recovery so you can review in Cloud → Emails.

### Out of scope
- No changes to in-app receipt PDF, settings page, or auth pages.
- No new database tables or RLS changes.
- No third-party email provider — using the existing Lovable Emails infrastructure on `1.amlaki1.app`.
