/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { normalizeLang, isRtl, fontFamily, getStrings, SITE_NAME_BY_LANG } from './translations.ts'

interface Props { confirmationUrl: string; lang?: string }

export const MagicLinkEmail = ({ confirmationUrl, lang }: Props) => {
  const L = normalizeLang(lang)
  const s = getStrings(L, 'magiclink')
  const dir = isRtl(L) ? 'rtl' : 'ltr'
  const ff = fontFamily(L)
  return (
    <Html lang={L} dir={dir}>
      <Head />
      <Preview>{s.preview}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: ff }}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME_BY_LANG[L]}</Heading>
          <Heading style={h1}>{s.heading}</Heading>
          <Text style={text}>{typeof s.body === 'string' ? s.body : ''}</Text>
          <Button style={button} href={confirmationUrl}>{s.button}</Button>
          <Text style={footer}>{s.footer}</Text>
          <Text style={signature}>{s.signature}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail

const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#5f7e65', margin: '0 0 24px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3d4d3f', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a6650', lineHeight: '1.7', margin: '0 0 24px' }
const button = { backgroundColor: '#5f7e65', color: '#ffffff', fontSize: '15px', borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', fontWeight: 'bold' as const }
const footer = { fontSize: '13px', color: '#7a8e7d', margin: '32px 0 0', lineHeight: '1.6' }
const signature = { fontSize: '13px', color: '#a89456', margin: '20px 0 0', fontWeight: 'bold' as const }
