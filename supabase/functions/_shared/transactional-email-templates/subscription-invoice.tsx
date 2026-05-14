/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface InvoiceProps {
  customerName?: string
  invoiceNumber?: string
  planName?: string
  amount?: string
  currency?: string
  issueDate?: string
  periodStart?: string
  periodEnd?: string
  paymentMethod?: string
}

const SubscriptionInvoiceEmail = ({
  customerName = 'عميلنا الكريم',
  invoiceNumber = '—',
  planName = 'اشتراك أملاكي',
  amount = '0',
  currency = 'SAR',
  issueDate = '—',
  periodStart,
  periodEnd,
  paymentMethod = 'بطاقة ائتمان',
}: InvoiceProps) => (
  <Html lang="ar" dir="rtl">
    <Head />
    <Preview>فاتورة اشتراك أملاكي رقم {invoiceNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>أملاكي</Heading>

        <Heading style={h1}>فاتورة الاشتراك</Heading>
        <Text style={text}>مرحباً {customerName}،</Text>
        <Text style={text}>
          شكراً لاشتراكك في أملاكي. فيما يلي تفاصيل فاتورتك.
        </Text>

        <Section style={card}>
          <Row>
            <Column style={labelCol}><Text style={label}>رقم الفاتورة</Text></Column>
            <Column><Text style={value}>{invoiceNumber}</Text></Column>
          </Row>
          <Row>
            <Column style={labelCol}><Text style={label}>تاريخ الإصدار</Text></Column>
            <Column><Text style={value}>{issueDate}</Text></Column>
          </Row>
          <Row>
            <Column style={labelCol}><Text style={label}>الباقة</Text></Column>
            <Column><Text style={value}>{planName}</Text></Column>
          </Row>
          {periodStart && periodEnd && (
            <Row>
              <Column style={labelCol}><Text style={label}>فترة الاشتراك</Text></Column>
              <Column><Text style={value}>{periodStart} — {periodEnd}</Text></Column>
            </Row>
          )}
          <Row>
            <Column style={labelCol}><Text style={label}>طريقة الدفع</Text></Column>
            <Column><Text style={value}>{paymentMethod}</Text></Column>
          </Row>
          <Hr style={hr} />
          <Row>
            <Column style={labelCol}><Text style={totalLabel}>الإجمالي المدفوع</Text></Column>
            <Column><Text style={totalValue}>{amount} {currency}</Text></Column>
          </Row>
        </Section>

        <Text style={footer}>
          هذه فاتورة آلية ولا تحتاج توقيعاً. إذا كان لديك أي استفسار، تواصل معنا عبر info@amlaki1.app.
        </Text>
        <Text style={signature}>فريق أملاكي</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionInvoiceEmail,
  subject: (d: Record<string, any>) => `فاتورة اشتراك أملاكي رقم ${d.invoiceNumber || ''}`.trim(),
  displayName: 'فاتورة الاشتراك',
  previewData: {
    customerName: 'محمد الدهيش',
    invoiceNumber: 'INV-2026-0001',
    planName: 'باقة أملاكي السنوية',
    amount: '299',
    currency: 'SAR',
    issueDate: '2026-05-14',
    periodStart: '2026-05-14',
    periodEnd: '2027-05-14',
    paymentMethod: 'Visa •••• 4242',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"Noto Kufi Arabic", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#5f7e65', margin: '0 0 24px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3d4d3f', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#4a6650', lineHeight: '1.7', margin: '0 0 12px' }
const card = { backgroundColor: '#faf6ee', borderRadius: '12px', padding: '20px 24px', margin: '24px 0' }
const labelCol = { width: '45%' }
const label = { fontSize: '13px', color: '#7a8e7d', margin: '6px 0' }
const value = { fontSize: '14px', color: '#3d4d3f', fontWeight: '600' as const, margin: '6px 0' }
const totalLabel = { fontSize: '15px', color: '#3d4d3f', fontWeight: 'bold' as const, margin: '8px 0' }
const totalValue = { fontSize: '18px', color: '#5f7e65', fontWeight: 'bold' as const, margin: '8px 0' }
const hr = { borderColor: '#e3ddcf', margin: '14px 0' }
const footer = { fontSize: '13px', color: '#7a8e7d', margin: '32px 0 0', lineHeight: '1.6' }
const signature = { fontSize: '13px', color: '#a89456', margin: '20px 0 0', fontWeight: 'bold' as const }
