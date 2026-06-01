/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  oldPrefix?: string
  oldStart?: string | number
  oldPadding?: string | number
  newPrefix?: string
  newStart?: string | number
  newPadding?: string | number
  nextPreview?: string
  changedAt?: string
}

const ReceiptNumberingChangedEmail = ({
  name = 'عميلنا الكريم',
  oldPrefix = '—',
  oldStart = '—',
  oldPadding = '—',
  newPrefix = '—',
  newStart = '—',
  newPadding = '—',
  nextPreview = '—',
  changedAt = '—',
}: Props) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>تم تحديث ترقيم الإيصالات في حسابك على أملاكي</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>أملاكي</Heading>
        <Heading style={h1}>تم تحديث ترقيم الإيصالات</Heading>
        <Text style={text}>مرحباً {name}،</Text>
        <Text style={text}>
          نُعلمك بأن إعدادات ترقيم الإيصالات في حسابك قد تم تعديلها بتاريخ {changedAt}. هذا التغيير سيُطبَّق على كل الإيصالات الجديدة الصادرة من حسابك.
        </Text>

        <Section style={card}>
          <Row>
            <Column style={labelCol}><Text style={label}>البادئة</Text></Column>
            <Column><Text style={value}>{String(oldPrefix)} ← <strong>{String(newPrefix)}</strong></Text></Column>
          </Row>
          <Row>
            <Column style={labelCol}><Text style={label}>رقم البداية</Text></Column>
            <Column><Text style={value}>{String(oldStart)} ← <strong>{String(newStart)}</strong></Text></Column>
          </Row>
          <Row>
            <Column style={labelCol}><Text style={label}>عدد الخانات</Text></Column>
            <Column><Text style={value}>{String(oldPadding)} ← <strong>{String(newPadding)}</strong></Text></Column>
          </Row>
          <Hr style={hr} />
          <Row>
            <Column style={labelCol}><Text style={totalLabel}>الرقم التالي سيكون</Text></Column>
            <Column><Text style={totalValue}>{nextPreview}</Text></Column>
          </Row>
        </Section>

        <Text style={warn}>
          إن لم يكن هذا التغيير منك، يُرجى مراجعة إعدادات حسابك فوراً وتغيير كلمة المرور.
        </Text>
        <Text style={footer}>
          هذه رسالة آلية للأمان والمراجعة. لأي استفسار: info@amlaki1.app
        </Text>
        <Text style={signature}>فريق أملاكي</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReceiptNumberingChangedEmail,
  subject: 'تم تحديث ترقيم الإيصالات في حسابك على أملاكي',
  displayName: 'تأكيد تغيير ترقيم الإيصالات',
  previewData: {
    name: 'محمد الدهيش',
    oldPrefix: 'R-',
    oldStart: '1',
    oldPadding: '0',
    newPrefix: 'INV-',
    newStart: '1001',
    newPadding: '4',
    nextPreview: 'INV-01001',
    changedAt: '2026-06-01 14:32',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Noto Kufi Arabic", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#5f7e65', margin: '0 0 24px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3d4d3f', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a6650', lineHeight: '1.7', margin: '0 0 12px' }
const card = { backgroundColor: '#faf6ee', borderRadius: '12px', padding: '20px 24px', margin: '24px 0' }
const labelCol = { width: '40%' }
const label = { fontSize: '13px', color: '#7a8e7d', margin: '6px 0' }
const value = { fontSize: '14px', color: '#3d4d3f', margin: '6px 0' }
const totalLabel = { fontSize: '15px', color: '#3d4d3f', fontWeight: 'bold' as const, margin: '8px 0' }
const totalValue = { fontSize: '18px', color: '#5f7e65', fontWeight: 'bold' as const, margin: '8px 0', fontFamily: 'monospace' }
const hr = { borderColor: '#e3ddcf', margin: '14px 0' }
const warn = { fontSize: '13px', color: '#a85d5d', margin: '20px 0 0', lineHeight: '1.6' }
const footer = { fontSize: '13px', color: '#7a8e7d', margin: '24px 0 0', lineHeight: '1.6' }
const signature = { fontSize: '13px', color: '#a89456', margin: '20px 0 0', fontWeight: 'bold' as const }
