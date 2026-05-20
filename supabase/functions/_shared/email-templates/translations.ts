// Translations for auth email templates (12 supported languages).
// Any language not in this list falls back to English.

export type EmailLang =
  | 'ar' | 'en' | 'ur' | 'fa' | 'hi' | 'zh'
  | 'tr' | 'ru' | 'fr' | 'es' | 'de' | 'pt'

export const SUPPORTED: EmailLang[] = [
  'ar', 'en', 'ur', 'fa', 'hi', 'zh', 'tr', 'ru', 'fr', 'es', 'de', 'pt',
]

const RTL: EmailLang[] = ['ar', 'ur', 'fa']

export function normalizeLang(input: unknown): EmailLang {
  if (typeof input !== 'string') return 'en'
  const base = input.toLowerCase().split('-')[0].split('_')[0]
  // Map other RTL languages we know about
  const aliasRtl: Record<string, EmailLang> = { he: 'en', ku: 'en', ps: 'fa' }
  if (aliasRtl[base]) return aliasRtl[base]
  return (SUPPORTED as string[]).includes(base) ? (base as EmailLang) : 'en'
}

export function isRtl(lang: EmailLang): boolean {
  return RTL.includes(lang)
}

export function fontFamily(lang: EmailLang): string {
  if (isRtl(lang)) return '"Noto Kufi Arabic", "Tahoma", Arial, sans-serif'
  if (lang === 'zh') return '"PingFang SC", "Microsoft YaHei", Arial, sans-serif'
  if (lang === 'hi') return '"Noto Sans Devanagari", Arial, sans-serif'
  return '"Outfit", "Helvetica Neue", Arial, sans-serif'
}

type TplKey =
  | 'signup' | 'recovery' | 'magiclink'
  | 'invite' | 'email_change' | 'reauthentication'

interface TplStrings {
  subject: string
  preview: string
  heading: string
  body: string | ((d: Record<string, string>) => string)
  button: string
  footer: string
  signature: string
}

type Bundle = Record<TplKey, TplStrings>

export const SITE_NAME_BY_LANG: Record<EmailLang, string> = {
  ar: 'أملاكي',
  ur: 'املاکی',
  fa: 'املاکی',
  en: 'Amlaki',
  fr: 'Amlaki',
  es: 'Amlaki',
  de: 'Amlaki',
  pt: 'Amlaki',
  it: 'Amlaki' as any,
  tr: 'Amlaki',
  ru: 'Амлаки',
  hi: 'अमलाकी',
  zh: '阿姆拉基',
}

export const TEAM_BY_LANG: Record<EmailLang, string> = {
  ar: 'فريق أملاكي',
  ur: 'املاکی ٹیم',
  fa: 'تیم املاکی',
  en: 'The Amlaki Team',
  fr: 'L\'équipe Amlaki',
  es: 'El equipo Amlaki',
  de: 'Das Amlaki-Team',
  pt: 'A equipa Amlaki',
  tr: 'Amlaki Ekibi',
  ru: 'Команда Амлаки',
  hi: 'अमलाकी टीम',
  zh: '阿姆拉基团队',
}

export const TRANSLATIONS: Record<EmailLang, Bundle> = {
  ar: {
    signup: { subject: 'تفعيل حسابك في أملاكي', preview: 'تفعيل حسابك في أملاكي', heading: 'أهلاً بك في أملاكي', body: 'شكراً لتسجيلك معنا. لإكمال إنشاء حسابك وتفعيله، اضغط على الزر أدناه.', button: 'تفعيل الحساب', footer: 'إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة.', signature: 'فريق أملاكي' },
    recovery: { subject: 'إعادة تعيين كلمة المرور - أملاكي', preview: 'إعادة تعيين كلمة المرور', heading: 'إعادة تعيين كلمة المرور', body: 'استلمنا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في أملاكي. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.', button: 'إعادة تعيين كلمة المرور', footer: 'إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة بأمان — كلمة المرور لن تتغيّر.', signature: 'فريق أملاكي' },
    magiclink: { subject: 'رابط الدخول إلى أملاكي', preview: 'رابط الدخول السريع', heading: 'رابط الدخول السريع', body: 'اضغط على الزر أدناه لتسجيل الدخول إلى حسابك في أملاكي.', button: 'تسجيل الدخول', footer: 'إذا لم تطلب هذا الرابط، تجاهل هذه الرسالة.', signature: 'فريق أملاكي' },
    invite: { subject: 'تمت دعوتك للانضمام إلى أملاكي', preview: 'تمت دعوتك', heading: 'تمت دعوتك', body: 'تمت دعوتك للانضمام إلى أملاكي. اضغط على الزر أدناه لقبول الدعوة وإنشاء حسابك.', button: 'قبول الدعوة', footer: 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.', signature: 'فريق أملاكي' },
    email_change: { subject: 'تأكيد تغيير البريد الإلكتروني', preview: 'تأكيد تغيير البريد', heading: 'تأكيد تغيير البريد الإلكتروني', body: (d) => `طلبت تغيير بريدك الإلكتروني في أملاكي من ${d.oldEmail} إلى ${d.newEmail}. اضغط على الزر أدناه للتأكيد.`, button: 'تأكيد التغيير', footer: 'إذا لم تطلب هذا التغيير، الرجاء تأمين حسابك فوراً.', signature: 'فريق أملاكي' },
    reauthentication: { subject: 'رمز التحقق الخاص بك', preview: 'رمز التحقق', heading: 'تأكيد الهوية', body: 'استخدم الرمز أدناه لتأكيد هويتك:', button: '', footer: 'سينتهي هذا الرمز قريباً. إذا لم تطلبه، تجاهل هذه الرسالة.', signature: 'فريق أملاكي' },
  },
  en: {
    signup: { subject: 'Confirm your email', preview: 'Confirm your email', heading: 'Welcome to Amlaki', body: 'Thanks for signing up. To finish creating and activating your account, tap the button below.', button: 'Confirm account', footer: "If you didn't create this account, you can safely ignore this email.", signature: 'The Amlaki Team' },
    recovery: { subject: 'Reset your password', preview: 'Reset your password', heading: 'Reset your password', body: 'We received a request to reset the password for your Amlaki account. Tap the button below to choose a new one.', button: 'Reset password', footer: "If you didn't request this, you can safely ignore this email — your password won't change.", signature: 'The Amlaki Team' },
    magiclink: { subject: 'Your login link', preview: 'Your login link', heading: 'Your login link', body: 'Tap the button below to sign in to your Amlaki account.', button: 'Sign in', footer: "If you didn't request this link, you can ignore this email.", signature: 'The Amlaki Team' },
    invite: { subject: "You've been invited to Amlaki", preview: "You've been invited", heading: "You've been invited", body: "You've been invited to join Amlaki. Tap the button below to accept the invitation and create your account.", button: 'Accept invitation', footer: "If you weren't expecting this invitation, you can safely ignore this email.", signature: 'The Amlaki Team' },
    email_change: { subject: 'Confirm your new email', preview: 'Confirm your email change', heading: 'Confirm your email change', body: (d) => `You requested to change your Amlaki email from ${d.oldEmail} to ${d.newEmail}. Tap the button below to confirm.`, button: 'Confirm change', footer: "If you didn't request this change, please secure your account immediately.", signature: 'The Amlaki Team' },
    reauthentication: { subject: 'Your verification code', preview: 'Your verification code', heading: 'Confirm your identity', body: 'Use the code below to confirm your identity:', button: '', footer: "This code will expire shortly. If you didn't request it, you can ignore this email.", signature: 'The Amlaki Team' },
  },
  ur: {
    signup: { subject: 'اپنا املاکی اکاؤنٹ تصدیق کریں', preview: 'اکاؤنٹ کی تصدیق', heading: 'املاکی میں خوش آمدید', body: 'سائن اپ کرنے کا شکریہ۔ اپنا اکاؤنٹ مکمل اور فعال کرنے کے لیے نیچے دیے گئے بٹن پر کلک کریں۔', button: 'اکاؤنٹ فعال کریں', footer: 'اگر یہ اکاؤنٹ آپ نے نہیں بنایا تو اس پیغام کو نظر انداز کریں۔', signature: 'املاکی ٹیم' },
    recovery: { subject: 'پاس ورڈ ری سیٹ کریں', preview: 'پاس ورڈ ری سیٹ', heading: 'پاس ورڈ ری سیٹ کریں', body: 'ہمیں آپ کے املاکی اکاؤنٹ کے لیے پاس ورڈ ری سیٹ کرنے کی درخواست موصول ہوئی۔ نیا پاس ورڈ منتخب کرنے کے لیے نیچے بٹن دبائیں۔', button: 'پاس ورڈ ری سیٹ', footer: 'اگر آپ نے یہ درخواست نہیں کی تو اس پیغام کو نظر انداز کریں — آپ کا پاس ورڈ تبدیل نہیں ہوگا۔', signature: 'املاکی ٹیم' },
    magiclink: { subject: 'املاکی میں سائن ان لنک', preview: 'سائن ان لنک', heading: 'فوری سائن ان لنک', body: 'اپنے املاکی اکاؤنٹ میں سائن ان کرنے کے لیے نیچے بٹن دبائیں۔', button: 'سائن ان کریں', footer: 'اگر آپ نے یہ لنک نہیں مانگا تو اس پیغام کو نظر انداز کریں۔', signature: 'املاکی ٹیم' },
    invite: { subject: 'آپ کو املاکی میں مدعو کیا گیا ہے', preview: 'آپ کو مدعو کیا گیا', heading: 'آپ کو مدعو کیا گیا ہے', body: 'آپ کو املاکی میں شامل ہونے کی دعوت دی گئی ہے۔ دعوت قبول کرنے اور اکاؤنٹ بنانے کے لیے نیچے بٹن دبائیں۔', button: 'دعوت قبول کریں', footer: 'اگر آپ کو اس دعوت کی توقع نہیں تھی تو اس پیغام کو نظر انداز کریں۔', signature: 'املاکی ٹیم' },
    email_change: { subject: 'نئے ای میل کی تصدیق کریں', preview: 'ای میل تبدیلی کی تصدیق', heading: 'ای میل تبدیلی کی تصدیق', body: (d) => `آپ نے اپنا املاکی ای میل ${d.oldEmail} سے ${d.newEmail} پر تبدیل کرنے کی درخواست کی۔ تصدیق کے لیے بٹن دبائیں۔`, button: 'تبدیلی کی تصدیق', footer: 'اگر آپ نے یہ تبدیلی نہیں کی تو فوراً اپنے اکاؤنٹ کو محفوظ کریں۔', signature: 'املاکی ٹیم' },
    reauthentication: { subject: 'آپ کا تصدیقی کوڈ', preview: 'تصدیقی کوڈ', heading: 'شناخت کی تصدیق', body: 'اپنی شناخت کی تصدیق کے لیے نیچے دیا گیا کوڈ استعمال کریں:', button: '', footer: 'یہ کوڈ جلد ختم ہو جائے گا۔ اگر آپ نے یہ نہیں مانگا تو پیغام کو نظر انداز کریں۔', signature: 'املاکی ٹیم' },
  },
  fa: {
    signup: { subject: 'تأیید حساب املاکی', preview: 'تأیید حساب', heading: 'به املاکی خوش آمدید', body: 'از ثبت‌نام شما متشکریم. برای تکمیل و فعال‌سازی حساب، روی دکمه زیر کلیک کنید.', button: 'فعال‌سازی حساب', footer: 'اگر این حساب را شما ایجاد نکرده‌اید، می‌توانید این پیام را نادیده بگیرید.', signature: 'تیم املاکی' },
    recovery: { subject: 'بازنشانی گذرواژه - املاکی', preview: 'بازنشانی گذرواژه', heading: 'بازنشانی گذرواژه', body: 'درخواست بازنشانی گذرواژه حساب املاکی شما را دریافت کردیم. برای انتخاب گذرواژه جدید روی دکمه زیر بزنید.', button: 'بازنشانی گذرواژه', footer: 'اگر این درخواست را شما نداده‌اید، می‌توانید این پیام را نادیده بگیرید — گذرواژه تغییر نمی‌کند.', signature: 'تیم املاکی' },
    magiclink: { subject: 'لینک ورود به املاکی', preview: 'لینک ورود', heading: 'لینک ورود سریع', body: 'برای ورود به حساب املاکی روی دکمه زیر بزنید.', button: 'ورود', footer: 'اگر این لینک را درخواست نکرده‌اید، این پیام را نادیده بگیرید.', signature: 'تیم املاکی' },
    invite: { subject: 'به املاکی دعوت شدید', preview: 'دعوت شدید', heading: 'شما دعوت شده‌اید', body: 'برای پیوستن به املاکی دعوت شده‌اید. برای پذیرش دعوت و ساخت حساب روی دکمه زیر بزنید.', button: 'پذیرش دعوت', footer: 'اگر منتظر این دعوت نبودید، می‌توانید این پیام را نادیده بگیرید.', signature: 'تیم املاکی' },
    email_change: { subject: 'تأیید ایمیل جدید', preview: 'تأیید تغییر ایمیل', heading: 'تأیید تغییر ایمیل', body: (d) => `درخواست تغییر ایمیل املاکی از ${d.oldEmail} به ${d.newEmail} داده‌اید. برای تأیید روی دکمه بزنید.`, button: 'تأیید تغییر', footer: 'اگر این تغییر را درخواست نکرده‌اید، فوراً حساب خود را ایمن کنید.', signature: 'تیم املاکی' },
    reauthentication: { subject: 'کد تأیید شما', preview: 'کد تأیید', heading: 'تأیید هویت', body: 'برای تأیید هویت از کد زیر استفاده کنید:', button: '', footer: 'این کد به‌زودی منقضی می‌شود. اگر آن را درخواست نکرده‌اید، پیام را نادیده بگیرید.', signature: 'تیم املاکی' },
  },
  hi: {
    signup: { subject: 'अपना Amlaki खाता पुष्टि करें', preview: 'खाता पुष्टि', heading: 'Amlaki में आपका स्वागत है', body: 'साइन अप करने के लिए धन्यवाद। अपना खाता बनाने और सक्रिय करने के लिए नीचे दिए गए बटन पर क्लिक करें।', button: 'खाता सक्रिय करें', footer: 'यदि आपने यह खाता नहीं बनाया, तो इस संदेश को अनदेखा करें।', signature: 'Amlaki टीम' },
    recovery: { subject: 'अपना पासवर्ड रीसेट करें', preview: 'पासवर्ड रीसेट', heading: 'पासवर्ड रीसेट करें', body: 'हमें आपके Amlaki खाते के लिए पासवर्ड रीसेट करने का अनुरोध मिला। नया पासवर्ड चुनने के लिए नीचे बटन दबाएं।', button: 'पासवर्ड रीसेट करें', footer: 'यदि आपने अनुरोध नहीं किया तो इसे अनदेखा करें — पासवर्ड नहीं बदलेगा।', signature: 'Amlaki टीम' },
    magiclink: { subject: 'आपका साइन-इन लिंक', preview: 'साइन-इन लिंक', heading: 'त्वरित साइन-इन लिंक', body: 'अपने Amlaki खाते में साइन इन करने के लिए नीचे बटन दबाएं।', button: 'साइन इन करें', footer: 'यदि आपने यह लिंक नहीं माँगा तो इस संदेश को अनदेखा करें।', signature: 'Amlaki टीम' },
    invite: { subject: 'आपको Amlaki में आमंत्रित किया गया है', preview: 'आपको आमंत्रित किया गया है', heading: 'आपको आमंत्रित किया गया है', body: 'आपको Amlaki में शामिल होने के लिए आमंत्रित किया गया है। आमंत्रण स्वीकार करने और खाता बनाने के लिए नीचे बटन दबाएं।', button: 'आमंत्रण स्वीकार करें', footer: 'यदि आप इस आमंत्रण की अपेक्षा नहीं कर रहे थे, तो संदेश को अनदेखा करें।', signature: 'Amlaki टीम' },
    email_change: { subject: 'अपना नया ईमेल पुष्टि करें', preview: 'ईमेल परिवर्तन पुष्टि', heading: 'ईमेल परिवर्तन पुष्टि', body: (d) => `आपने अपना Amlaki ईमेल ${d.oldEmail} से ${d.newEmail} में बदलने का अनुरोध किया। पुष्टि के लिए बटन दबाएं।`, button: 'परिवर्तन पुष्टि करें', footer: 'यदि आपने यह परिवर्तन नहीं किया, तो तुरंत अपना खाता सुरक्षित करें।', signature: 'Amlaki टीम' },
    reauthentication: { subject: 'आपका सत्यापन कोड', preview: 'सत्यापन कोड', heading: 'पहचान की पुष्टि करें', body: 'अपनी पहचान की पुष्टि के लिए नीचे दिए गए कोड का उपयोग करें:', button: '', footer: 'यह कोड जल्दी समाप्त हो जाएगा। यदि आपने इसका अनुरोध नहीं किया तो अनदेखा करें।', signature: 'Amlaki टीम' },
  },
  zh: {
    signup: { subject: '确认您的 Amlaki 账户', preview: '确认账户', heading: '欢迎使用 Amlaki', body: '感谢您的注册。请点击下方按钮完成账户创建和激活。', button: '激活账户', footer: '如果您未创建此账户,请忽略此邮件。', signature: 'Amlaki 团队' },
    recovery: { subject: '重置您的密码', preview: '重置密码', heading: '重置您的密码', body: '我们收到了重置您 Amlaki 账户密码的请求。点击下方按钮设置新密码。', button: '重置密码', footer: '如果您未发起此请求,可安全忽略本邮件 — 密码不会更改。', signature: 'Amlaki 团队' },
    magiclink: { subject: '您的登录链接', preview: '登录链接', heading: '快速登录链接', body: '点击下方按钮登录您的 Amlaki 账户。', button: '登录', footer: '如果您未请求此链接,请忽略本邮件。', signature: 'Amlaki 团队' },
    invite: { subject: '您已被邀请加入 Amlaki', preview: '您被邀请了', heading: '您已被邀请', body: '您已被邀请加入 Amlaki。点击下方按钮接受邀请并创建账户。', button: '接受邀请', footer: '如果您未预期收到此邀请,可忽略本邮件。', signature: 'Amlaki 团队' },
    email_change: { subject: '确认您的新邮箱', preview: '确认邮箱更改', heading: '确认邮箱更改', body: (d) => `您请求将 Amlaki 邮箱从 ${d.oldEmail} 更改为 ${d.newEmail}。点击下方按钮确认。`, button: '确认更改', footer: '如果您未发起此更改,请立即保护您的账户。', signature: 'Amlaki 团队' },
    reauthentication: { subject: '您的验证码', preview: '验证码', heading: '确认身份', body: '使用下方代码确认您的身份:', button: '', footer: '此代码即将过期。如果您未请求,请忽略本邮件。', signature: 'Amlaki 团队' },
  },
  tr: {
    signup: { subject: 'Amlaki hesabınızı onaylayın', preview: 'Hesabınızı onaylayın', heading: 'Amlaki\'ye hoş geldiniz', body: 'Kaydolduğunuz için teşekkürler. Hesabınızı oluşturmayı ve etkinleştirmeyi tamamlamak için aşağıdaki düğmeye dokunun.', button: 'Hesabı etkinleştir', footer: 'Bu hesabı siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.', signature: 'Amlaki Ekibi' },
    recovery: { subject: 'Şifrenizi sıfırlayın', preview: 'Şifre sıfırlama', heading: 'Şifrenizi sıfırlayın', body: 'Amlaki hesabınızın şifresini sıfırlama talebi aldık. Yeni bir şifre seçmek için aşağıdaki düğmeye dokunun.', button: 'Şifreyi sıfırla', footer: 'Bunu siz talep etmediyseniz e-postayı yok sayabilirsiniz — şifreniz değişmez.', signature: 'Amlaki Ekibi' },
    magiclink: { subject: 'Giriş bağlantınız', preview: 'Giriş bağlantısı', heading: 'Hızlı giriş bağlantısı', body: 'Amlaki hesabınıza giriş yapmak için aşağıdaki düğmeye dokunun.', button: 'Giriş yap', footer: 'Bu bağlantıyı talep etmediyseniz bu e-postayı yok sayın.', signature: 'Amlaki Ekibi' },
    invite: { subject: 'Amlaki\'ye davet edildiniz', preview: 'Davet edildiniz', heading: 'Davet edildiniz', body: 'Amlaki\'ye katılmaya davet edildiniz. Daveti kabul etmek ve hesap oluşturmak için aşağıdaki düğmeye dokunun.', button: 'Daveti kabul et', footer: 'Bu daveti beklemiyorduysanız e-postayı yok sayabilirsiniz.', signature: 'Amlaki Ekibi' },
    email_change: { subject: 'Yeni e-postanızı onaylayın', preview: 'E-posta değişikliği onayı', heading: 'E-posta değişikliğini onaylayın', body: (d) => `Amlaki e-postanızı ${d.oldEmail} adresinden ${d.newEmail} adresine değiştirmeyi talep ettiniz. Onaylamak için düğmeye dokunun.`, button: 'Değişikliği onayla', footer: 'Bu değişikliği siz talep etmediyseniz hesabınızı hemen güvence altına alın.', signature: 'Amlaki Ekibi' },
    reauthentication: { subject: 'Doğrulama kodunuz', preview: 'Doğrulama kodu', heading: 'Kimliğinizi onaylayın', body: 'Kimliğinizi onaylamak için aşağıdaki kodu kullanın:', button: '', footer: 'Bu kodun süresi kısa sürede dolacak. Siz talep etmediyseniz e-postayı yok sayabilirsiniz.', signature: 'Amlaki Ekibi' },
  },
  ru: {
    signup: { subject: 'Подтвердите учётную запись Амлаки', preview: 'Подтверждение учётной записи', heading: 'Добро пожаловать в Амлаки', body: 'Спасибо за регистрацию. Чтобы завершить создание и активацию учётной записи, нажмите кнопку ниже.', button: 'Активировать учётную запись', footer: 'Если вы не создавали эту учётную запись, просто проигнорируйте это сообщение.', signature: 'Команда Амлаки' },
    recovery: { subject: 'Сброс пароля - Амлаки', preview: 'Сброс пароля', heading: 'Сбросить пароль', body: 'Мы получили запрос на сброс пароля для вашей учётной записи Амлаки. Нажмите кнопку ниже, чтобы выбрать новый пароль.', button: 'Сбросить пароль', footer: 'Если вы не запрашивали сброс, просто проигнорируйте это сообщение — пароль не изменится.', signature: 'Команда Амлаки' },
    magiclink: { subject: 'Ссылка для входа', preview: 'Ссылка для входа', heading: 'Быстрая ссылка для входа', body: 'Нажмите кнопку ниже, чтобы войти в учётную запись Амлаки.', button: 'Войти', footer: 'Если вы не запрашивали эту ссылку, проигнорируйте сообщение.', signature: 'Команда Амлаки' },
    invite: { subject: 'Приглашение в Амлаки', preview: 'Вас пригласили', heading: 'Вас пригласили', body: 'Вас пригласили присоединиться к Амлаки. Нажмите кнопку ниже, чтобы принять приглашение и создать учётную запись.', button: 'Принять приглашение', footer: 'Если вы не ждали этого приглашения, проигнорируйте сообщение.', signature: 'Команда Амлаки' },
    email_change: { subject: 'Подтвердите новый адрес', preview: 'Подтверждение смены адреса', heading: 'Подтвердите смену адреса', body: (d) => `Вы запросили смену email в Амлаки с ${d.oldEmail} на ${d.newEmail}. Нажмите кнопку, чтобы подтвердить.`, button: 'Подтвердить', footer: 'Если вы не запрашивали смену, немедленно защитите свою учётную запись.', signature: 'Команда Амлаки' },
    reauthentication: { subject: 'Ваш проверочный код', preview: 'Проверочный код', heading: 'Подтверждение личности', body: 'Используйте код ниже для подтверждения личности:', button: '', footer: 'Срок действия кода скоро истечёт. Если вы не запрашивали его, проигнорируйте сообщение.', signature: 'Команда Амлаки' },
  },
  fr: {
    signup: { subject: 'Confirmez votre compte Amlaki', preview: 'Confirmation du compte', heading: 'Bienvenue sur Amlaki', body: 'Merci pour votre inscription. Pour finaliser et activer votre compte, cliquez sur le bouton ci-dessous.', button: 'Activer le compte', footer: "Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer ce message.", signature: "L'équipe Amlaki" },
    recovery: { subject: 'Réinitialisez votre mot de passe', preview: 'Réinitialisation du mot de passe', heading: 'Réinitialiser votre mot de passe', body: 'Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Amlaki. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.', button: 'Réinitialiser', footer: "Si vous n'avez rien demandé, ignorez ce message — votre mot de passe ne sera pas modifié.", signature: "L'équipe Amlaki" },
    magiclink: { subject: 'Votre lien de connexion', preview: 'Lien de connexion', heading: 'Lien de connexion rapide', body: 'Cliquez sur le bouton ci-dessous pour vous connecter à votre compte Amlaki.', button: 'Se connecter', footer: "Si vous n'avez pas demandé ce lien, ignorez ce message.", signature: "L'équipe Amlaki" },
    invite: { subject: 'Vous êtes invité sur Amlaki', preview: 'Vous êtes invité', heading: 'Vous êtes invité', body: 'Vous êtes invité à rejoindre Amlaki. Cliquez sur le bouton ci-dessous pour accepter et créer votre compte.', button: "Accepter l'invitation", footer: "Si vous n'attendiez pas cette invitation, ignorez ce message.", signature: "L'équipe Amlaki" },
    email_change: { subject: 'Confirmez votre nouvel e-mail', preview: 'Confirmation du changement', heading: "Confirmer le changement d'e-mail", body: (d) => `Vous avez demandé à changer votre e-mail Amlaki de ${d.oldEmail} vers ${d.newEmail}. Cliquez pour confirmer.`, button: 'Confirmer le changement', footer: "Si vous n'avez pas demandé ce changement, sécurisez votre compte immédiatement.", signature: "L'équipe Amlaki" },
    reauthentication: { subject: 'Votre code de vérification', preview: 'Code de vérification', heading: 'Confirmez votre identité', body: 'Utilisez le code ci-dessous pour confirmer votre identité :', button: '', footer: "Ce code expirera bientôt. Si vous n'avez rien demandé, ignorez ce message.", signature: "L'équipe Amlaki" },
  },
  es: {
    signup: { subject: 'Confirma tu cuenta de Amlaki', preview: 'Confirmación de cuenta', heading: 'Bienvenido a Amlaki', body: 'Gracias por registrarte. Para terminar de crear y activar tu cuenta, pulsa el botón de abajo.', button: 'Activar cuenta', footer: 'Si no creaste esta cuenta, puedes ignorar este mensaje.', signature: 'El equipo Amlaki' },
    recovery: { subject: 'Restablece tu contraseña', preview: 'Restablecer contraseña', heading: 'Restablece tu contraseña', body: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Amlaki. Pulsa el botón para elegir una nueva.', button: 'Restablecer contraseña', footer: 'Si no solicitaste esto, ignora este mensaje — tu contraseña no cambiará.', signature: 'El equipo Amlaki' },
    magiclink: { subject: 'Tu enlace de acceso', preview: 'Enlace de acceso', heading: 'Enlace de acceso rápido', body: 'Pulsa el botón de abajo para iniciar sesión en tu cuenta de Amlaki.', button: 'Iniciar sesión', footer: 'Si no solicitaste este enlace, ignora este mensaje.', signature: 'El equipo Amlaki' },
    invite: { subject: 'Te han invitado a Amlaki', preview: 'Te han invitado', heading: 'Te han invitado', body: 'Te han invitado a unirte a Amlaki. Pulsa el botón para aceptar la invitación y crear tu cuenta.', button: 'Aceptar invitación', footer: 'Si no esperabas esta invitación, ignora este mensaje.', signature: 'El equipo Amlaki' },
    email_change: { subject: 'Confirma tu nuevo correo', preview: 'Confirmar cambio de correo', heading: 'Confirma el cambio de correo', body: (d) => `Solicitaste cambiar tu correo de Amlaki de ${d.oldEmail} a ${d.newEmail}. Pulsa el botón para confirmar.`, button: 'Confirmar cambio', footer: 'Si no solicitaste este cambio, protege tu cuenta de inmediato.', signature: 'El equipo Amlaki' },
    reauthentication: { subject: 'Tu código de verificación', preview: 'Código de verificación', heading: 'Confirma tu identidad', body: 'Usa el código de abajo para confirmar tu identidad:', button: '', footer: 'Este código expirará pronto. Si no lo solicitaste, ignora este mensaje.', signature: 'El equipo Amlaki' },
  },
  de: {
    signup: { subject: 'Bestätige dein Amlaki-Konto', preview: 'Konto bestätigen', heading: 'Willkommen bei Amlaki', body: 'Danke für deine Registrierung. Um die Kontoerstellung abzuschließen und zu aktivieren, tippe auf die Schaltfläche unten.', button: 'Konto aktivieren', footer: 'Falls du dieses Konto nicht erstellt hast, kannst du diese Nachricht ignorieren.', signature: 'Das Amlaki-Team' },
    recovery: { subject: 'Passwort zurücksetzen', preview: 'Passwort zurücksetzen', heading: 'Passwort zurücksetzen', body: 'Wir haben eine Anfrage zum Zurücksetzen deines Amlaki-Passworts erhalten. Tippe auf die Schaltfläche, um ein neues zu wählen.', button: 'Passwort zurücksetzen', footer: 'Falls du das nicht angefordert hast, ignoriere die Nachricht — dein Passwort bleibt unverändert.', signature: 'Das Amlaki-Team' },
    magiclink: { subject: 'Dein Anmeldelink', preview: 'Anmeldelink', heading: 'Schneller Anmeldelink', body: 'Tippe auf die Schaltfläche, um dich bei deinem Amlaki-Konto anzumelden.', button: 'Anmelden', footer: 'Falls du diesen Link nicht angefordert hast, ignoriere die Nachricht.', signature: 'Das Amlaki-Team' },
    invite: { subject: 'Du wurdest zu Amlaki eingeladen', preview: 'Einladung', heading: 'Du wurdest eingeladen', body: 'Du wurdest eingeladen, Amlaki beizutreten. Tippe auf die Schaltfläche, um die Einladung anzunehmen und dein Konto zu erstellen.', button: 'Einladung annehmen', footer: 'Falls du diese Einladung nicht erwartet hast, ignoriere die Nachricht.', signature: 'Das Amlaki-Team' },
    email_change: { subject: 'Bestätige deine neue E-Mail', preview: 'E-Mail-Änderung bestätigen', heading: 'E-Mail-Änderung bestätigen', body: (d) => `Du hast angefordert, deine Amlaki-E-Mail von ${d.oldEmail} zu ${d.newEmail} zu ändern. Tippe auf die Schaltfläche zur Bestätigung.`, button: 'Änderung bestätigen', footer: 'Falls du diese Änderung nicht angefordert hast, sichere dein Konto sofort.', signature: 'Das Amlaki-Team' },
    reauthentication: { subject: 'Dein Bestätigungscode', preview: 'Bestätigungscode', heading: 'Identität bestätigen', body: 'Verwende den Code unten, um deine Identität zu bestätigen:', button: '', footer: 'Dieser Code läuft bald ab. Falls du ihn nicht angefordert hast, ignoriere die Nachricht.', signature: 'Das Amlaki-Team' },
  },
  pt: {
    signup: { subject: 'Confirme a sua conta Amlaki', preview: 'Confirmação da conta', heading: 'Bem-vindo à Amlaki', body: 'Obrigado por se registar. Para concluir a criação e ativar a sua conta, toque no botão abaixo.', button: 'Ativar conta', footer: 'Se não foi você que criou esta conta, pode ignorar esta mensagem.', signature: 'A equipa Amlaki' },
    recovery: { subject: 'Redefina a sua palavra-passe', preview: 'Redefinir palavra-passe', heading: 'Redefina a sua palavra-passe', body: 'Recebemos um pedido para redefinir a palavra-passe da sua conta Amlaki. Toque no botão para escolher uma nova.', button: 'Redefinir', footer: 'Se não pediu isto, ignore esta mensagem — a sua palavra-passe não muda.', signature: 'A equipa Amlaki' },
    magiclink: { subject: 'O seu link de acesso', preview: 'Link de acesso', heading: 'Link de acesso rápido', body: 'Toque no botão abaixo para iniciar sessão na sua conta Amlaki.', button: 'Iniciar sessão', footer: 'Se não pediu este link, ignore esta mensagem.', signature: 'A equipa Amlaki' },
    invite: { subject: 'Foi convidado para a Amlaki', preview: 'Foi convidado', heading: 'Foi convidado', body: 'Foi convidado a juntar-se à Amlaki. Toque no botão para aceitar o convite e criar a sua conta.', button: 'Aceitar convite', footer: 'Se não estava à espera deste convite, ignore esta mensagem.', signature: 'A equipa Amlaki' },
    email_change: { subject: 'Confirme o seu novo e-mail', preview: 'Confirmar alteração de e-mail', heading: 'Confirmar alteração de e-mail', body: (d) => `Pediu para alterar o seu e-mail Amlaki de ${d.oldEmail} para ${d.newEmail}. Toque no botão para confirmar.`, button: 'Confirmar alteração', footer: 'Se não pediu esta alteração, proteja a sua conta imediatamente.', signature: 'A equipa Amlaki' },
    reauthentication: { subject: 'O seu código de verificação', preview: 'Código de verificação', heading: 'Confirme a sua identidade', body: 'Use o código abaixo para confirmar a sua identidade:', button: '', footer: 'Este código expirará em breve. Se não o pediu, ignore esta mensagem.', signature: 'A equipa Amlaki' },
  },
}

export function getStrings(lang: EmailLang, key: TplKey): TplStrings {
  return TRANSLATIONS[lang][key] || TRANSLATIONS.en[key]
}
