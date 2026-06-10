/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Preview } from 'npm:@react-email/components@0.0.22'

interface Props { confirmationUrl: string; lang?: string }

// Bilingual (Arabic / English) Amlaki confirm-account email.
// Uses table-based layout (Outlook-safe) inside React Email's Body/Container.
export const SignupEmail = ({ confirmationUrl }: Props) => {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>اضغط لتأكيد بريدك وتفعيل حسابك في أملاكي · Confirm your email to activate your Amlaki account</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#ffffff', WebkitTextSizeAdjust: '100%' }}>
        <Container style={{ width: '100%', maxWidth: '100%', padding: 0, margin: 0 }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ background: '#ECEAE2', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td align="center" style={{ padding: '32px 16px' }}>
                  {/* card */}
                  <table role="presentation" width={600} cellPadding={0} cellSpacing={0}
                    style={{ width: '600px', maxWidth: '600px', background: '#FBFAF7', border: '1px solid #E3E0D8', borderRadius: '16px', overflow: 'hidden', borderCollapse: 'collapse' }}>
                    <tbody>
                      {/* navy header */}
                      <tr>
                        <td align="center" style={{ background: '#272B3A', padding: '34px 32px 30px' }}>
                          <table role="presentation" cellPadding={0} cellSpacing={0} align="center" style={{ borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr>
                                <td align="center" style={{ width: '62px', height: '62px', background: '#B8924A', borderRadius: '16px', fontSize: '30px', lineHeight: '62px', textAlign: 'center', color: '#FBFAF7' }}>🔑</td>
                              </tr>
                              <tr><td style={{ height: '14px', lineHeight: '14px', fontSize: 0 }}>&nbsp;</td></tr>
                              <tr>
                                <td align="center" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#FBFAF7', fontSize: '30px', fontWeight: 700, letterSpacing: '1px' }}>أملاكي</td>
                              </tr>
                              <tr>
                                <td align="center" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#B8924A', fontSize: '11px', fontWeight: 600, letterSpacing: '5px', paddingTop: '5px' }}>A M L A K I</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      {/* gold accent rule */}
                      <tr><td style={{ height: '4px', lineHeight: '4px', fontSize: 0, background: '#B8924A' }}>&nbsp;</td></tr>

                      {/* body */}
                      <tr>
                        <td style={{ padding: '40px 44px 8px', textAlign: 'right', direction: 'rtl' }}>
                          <p style={{ margin: '0 0 14px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#B8924A', fontSize: '12px', fontWeight: 700, letterSpacing: '2px' }}>
                            تأكيد الحساب · <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>CONFIRM ACCOUNT</span>
                          </p>

                          <h1 style={{ margin: '0 0 6px', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#272B3A', fontSize: '27px', fontWeight: 700, lineHeight: 1.4 }}>
                            أهلاً بك في أملاكي
                          </h1>
                          <p style={{ margin: '0 0 22px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#8A8779', fontSize: '14px', fontWeight: 600, textAlign: 'left', direction: 'ltr', unicodeBidi: 'isolate' }}>
                            Welcome to Amlaki
                          </p>

                          <p style={{ margin: '0 0 8px', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#1A1C24', fontSize: '16px', lineHeight: 1.95 }}>
                            سجّلت للتو في أملاكي. اضغط الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.
                          </p>
                          <p style={{ margin: '0 0 30px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#8A8779', fontSize: '14px', lineHeight: 1.7, textAlign: 'left', direction: 'ltr', unicodeBidi: 'isolate' }}>
                            You just signed up for Amlaki. Confirm your email to activate your account.
                          </p>

                          {/* CTA */}
                          <table role="presentation" cellPadding={0} cellSpacing={0} align="center" style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr>
                                <td align="center" bgcolor="#B8924A" style={{ borderRadius: '12px' }}>
                                  <a href={confirmationUrl} target="_blank" rel="noreferrer"
                                    style={{ display: 'inline-block', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#FFFFFF', fontSize: '17px', fontWeight: 700, textDecoration: 'none', padding: '17px 52px', borderRadius: '12px' }}>
                                    تأكيد الحساب &nbsp;·&nbsp; <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>Confirm account</span>
                                  </a>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {/* fallback link */}
                          <p style={{ margin: '30px 0 8px', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#8A8779', fontSize: '13px', lineHeight: 1.7 }}>
                            لم يعمل الزر؟ انسخ هذا الرابط والصقه في المتصفح:
                          </p>
                          <p style={{ margin: '0 0 4px', padding: '12px 14px', background: '#E9DFC8', borderRadius: '10px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', lineHeight: 1.6, color: '#5d5a4f', wordBreak: 'break-all', direction: 'ltr', textAlign: 'left' }}>
                            {confirmationUrl}
                          </p>
                        </td>
                      </tr>

                      {/* divider */}
                      <tr>
                        <td style={{ padding: '24px 44px 0' }}>
                          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr><td style={{ borderTop: '1px solid #E3E0D8', height: '1px', lineHeight: '1px', fontSize: 0 }}>&nbsp;</td></tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      {/* security note */}
                      <tr>
                        <td style={{ padding: '20px 44px 36px', textAlign: 'right', direction: 'rtl' }}>
                          <p style={{ margin: '0 0 4px', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#8A8779', fontSize: '13px', lineHeight: 1.8 }}>
                            الرابط صالح لفترة محدودة. إذا لم تنشئ هذا الحساب، تجاهل هذه الرسالة بأمان.
                          </p>
                          <p style={{ margin: 0, fontFamily: 'Arial, Helvetica, sans-serif', color: '#A9A697', fontSize: '12px', lineHeight: 1.6, textAlign: 'left', direction: 'ltr', unicodeBidi: 'isolate' }}>
                            This link expires soon. If you didn't create this account, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>

                      {/* footer */}
                      <tr>
                        <td align="center" style={{ background: '#272B3A', padding: '24px 32px' }}>
                          <p style={{ margin: '0 0 4px', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#B8924A', fontSize: '14px', fontWeight: 700 }}>
                            فريق أملاكي · Amlaki Team
                          </p>
                          <p style={{ margin: 0, fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: '#8A8779', fontSize: '12px' }}>
                            إدارة عقاراتك بذكاء · Smart property management
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </Container>
      </Body>
    </Html>
  )
}

export default SignupEmail
