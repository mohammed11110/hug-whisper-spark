/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Text, Section } from 'npm:@react-email/components@0.0.22'
import { normalizeLang, isRtl, fontFamily, getStrings, SITE_NAME_BY_LANG } from './translations.ts'

interface Props { confirmationUrl: string; token?: string; lang?: string }

export const RecoveryEmail = ({ token, lang }: Props) => {
  const L = normalizeLang(lang)
  const s = getStrings(L, 'recovery')
  const dir = isRtl(L) ? 'rtl' : 'ltr'
  const ff = fontFamily(L)

  // Localized copy for the OTP-style recovery email
  const COPY: Record<string, { intro: string; codeLabel: string; instruction: string; expires: string }> = {
    ar: {
      intro: 'استلمنا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في أملاكي.',
      codeLabel: 'رمز إعادة التعيين',
      instruction: 'أدخل هذا الرمز في صفحة إعادة تعيين كلمة المرور داخل التطبيق أو المتصفح.',
      expires: 'صالح لمدة ساعة واحدة فقط.',
    },
    en: {
      intro: 'We received a request to reset the password for your Amlaki account.',
      codeLabel: 'Your reset code',
      instruction: 'Enter this code on the password reset screen in the app or browser.',
      expires: 'Valid for one hour only.',
    },
  }
  const c = COPY[L] ?? COPY.en

  return (
    <Html lang={L} dir={dir}>
      <Head />
      <Preview>{s.preview}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: ff }}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME_BY_LANG[L]}</Heading>
          <Heading style={h1}>{s.heading}</Heading>
          <Text style={text}>{c.intro}</Text>

          <Section style={codeBox}>
            <Text style={codeLabel}>{c.codeLabel}</Text>
            <Text style={codeValue}>{token ?? '------'}</Text>
          </Section>

          <Text style={text}>{c.instruction}</Text>
          <Text style={small}>{c.expires}</Text>

          <Text style={footer}>{s.footer}</Text>
          <Text style={signature}>{s.signature}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail

const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#5f7e65', margin: '0 0 24px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3d4d3f', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a6650', lineHeight: '1.7', margin: '0 0 16px' }
const small = { fontSize: '13px', color: '#7a8e7d', margin: '0 0 24px' }
const codeBox = { backgroundColor: '#f5f0e6', borderRadius: '14px', padding: '20px 24px', margin: '20px 0 24px', textAlign: 'center' as const, border: '1px solid rgba(95,126,101,0.15)' }
const codeLabel = { fontSize: '12px', color: '#7a8e7d', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '1px', fontWeight: 'bold' as const }
const codeValue = { fontSize: '34px', fontWeight: 'bold' as const, color: '#3d4d3f', margin: 0, letterSpacing: '8px', fontFamily: '"SF Mono", "Menlo", monospace' }
const footer = { fontSize: '13px', color: '#7a8e7d', margin: '32px 0 0', lineHeight: '1.6' }
const signature = { fontSize: '13px', color: '#a89456', margin: '20px 0 0', fontWeight: 'bold' as const }
