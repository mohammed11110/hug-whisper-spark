/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>رابط الدخول إلى أملاكي</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>أملاكي</Heading>
        <Heading style={h1}>رابط الدخول السريع</Heading>
        <Text style={text}>اضغط على الزر أدناه لتسجيل الدخول إلى حسابك في أملاكي.</Text>
        <Button style={button} href={confirmationUrl}>تسجيل الدخول</Button>
        <Text style={footer}>إذا لم تطلب هذا الرابط، تجاهل هذه الرسالة.</Text>
        <Text style={signature}>فريق أملاكي</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Noto Kufi Arabic", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#5f7e65', margin: '0 0 24px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3d4d3f', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a6650', lineHeight: '1.7', margin: '0 0 24px' }
const button = { backgroundColor: '#5f7e65', color: '#ffffff', fontSize: '15px', borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', fontWeight: 'bold' as const }
const footer = { fontSize: '13px', color: '#7a8e7d', margin: '32px 0 0', lineHeight: '1.6' }
const signature = { fontSize: '13px', color: '#a89456', margin: '20px 0 0', fontWeight: 'bold' as const }
