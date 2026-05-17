import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang =
  | "ar" | "ur" | "en" | "zh" | "hi" | "bn" | "fr" | "es" | "tr"
  | "pt" | "de" | "it" | "ru" | "ja" | "ko" | "id" | "ms" | "fa"
  | "fil" | "vi" | "th" | "sw" | "nl" | "pl" | "uk" | "ro" | "el"
  | "he" | "az" | "kk" | "uz" | "ps" | "am" | "ha" | "yo" | "so"
  | "ku" | "sv" | "no" | "da" | "fi" | "cs" | "hu" | "bg" | "sr"
  | "hr" | "sk" | "sl" | "lt" | "lv" | "et" | "ka" | "hy" | "my"
  | "km" | "lo" | "si" | "ne" | "pa" | "ta" | "te" | "ml" | "kn"
  | "gu" | "mr" | "or";

export const LANGUAGES: { code: Lang; name: string; flag: string; rtl: boolean }[] = [
  { code: "ar", name: "العربية", flag: "🇸🇦", rtl: true },
  { code: "en", name: "English", flag: "🇬🇧", rtl: false },
  { code: "ur", name: "اردو", flag: "🇵🇰", rtl: true },
  { code: "fa", name: "فارسی", flag: "🇮🇷", rtl: true },
  { code: "he", name: "עברית", flag: "🇮🇱", rtl: true },
  { code: "ku", name: "کوردی", flag: "🇮🇶", rtl: true },
  { code: "ps", name: "پښتو", flag: "🇦🇫", rtl: true },
  { code: "zh", name: "中文", flag: "🇨🇳", rtl: false },
  { code: "ja", name: "日本語", flag: "🇯🇵", rtl: false },
  { code: "ko", name: "한국어", flag: "🇰🇷", rtl: false },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳", rtl: false },
  { code: "bn", name: "বাংলা", flag: "🇧🇩", rtl: false },
  { code: "pa", name: "ਪੰਜਾਬੀ", flag: "🇮🇳", rtl: false },
  { code: "ta", name: "தமிழ்", flag: "🇮🇳", rtl: false },
  { code: "te", name: "తెలుగు", flag: "🇮🇳", rtl: false },
  { code: "ml", name: "മലയാളം", flag: "🇮🇳", rtl: false },
  { code: "kn", name: "ಕನ್ನಡ", flag: "🇮🇳", rtl: false },
  { code: "gu", name: "ગુજરાતી", flag: "🇮🇳", rtl: false },
  { code: "mr", name: "मराठी", flag: "🇮🇳", rtl: false },
  { code: "or", name: "ଓଡ଼ିଆ", flag: "🇮🇳", rtl: false },
  { code: "ne", name: "नेपाली", flag: "🇳🇵", rtl: false },
  { code: "si", name: "සිංහල", flag: "🇱🇰", rtl: false },
  { code: "my", name: "မြန်မာ", flag: "🇲🇲", rtl: false },
  { code: "th", name: "ไทย", flag: "🇹🇭", rtl: false },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳", rtl: false },
  { code: "km", name: "ខ្មែរ", flag: "🇰🇭", rtl: false },
  { code: "lo", name: "ລາວ", flag: "🇱🇦", rtl: false },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩", rtl: false },
  { code: "ms", name: "Bahasa Melayu", flag: "🇲🇾", rtl: false },
  { code: "fil", name: "Filipino", flag: "🇵🇭", rtl: false },
  { code: "fr", name: "Français", flag: "🇫🇷", rtl: false },
  { code: "es", name: "Español", flag: "🇪🇸", rtl: false },
  { code: "pt", name: "Português", flag: "🇵🇹", rtl: false },
  { code: "de", name: "Deutsch", flag: "🇩🇪", rtl: false },
  { code: "it", name: "Italiano", flag: "🇮🇹", rtl: false },
  { code: "nl", name: "Nederlands", flag: "🇳🇱", rtl: false },
  { code: "sv", name: "Svenska", flag: "🇸🇪", rtl: false },
  { code: "no", name: "Norsk", flag: "🇳🇴", rtl: false },
  { code: "da", name: "Dansk", flag: "🇩🇰", rtl: false },
  { code: "fi", name: "Suomi", flag: "🇫🇮", rtl: false },
  { code: "pl", name: "Polski", flag: "🇵🇱", rtl: false },
  { code: "cs", name: "Čeština", flag: "🇨🇿", rtl: false },
  { code: "sk", name: "Slovenčina", flag: "🇸🇰", rtl: false },
  { code: "hu", name: "Magyar", flag: "🇭🇺", rtl: false },
  { code: "ro", name: "Română", flag: "🇷🇴", rtl: false },
  { code: "bg", name: "Български", flag: "🇧🇬", rtl: false },
  { code: "sr", name: "Српски", flag: "🇷🇸", rtl: false },
  { code: "hr", name: "Hrvatski", flag: "🇭🇷", rtl: false },
  { code: "sl", name: "Slovenščina", flag: "🇸🇮", rtl: false },
  { code: "el", name: "Ελληνικά", flag: "🇬🇷", rtl: false },
  { code: "tr", name: "Türkçe", flag: "🇹🇷", rtl: false },
  { code: "az", name: "Azərbaycan", flag: "🇦🇿", rtl: false },
  { code: "kk", name: "Қазақша", flag: "🇰🇿", rtl: false },
  { code: "uz", name: "Oʻzbekcha", flag: "🇺🇿", rtl: false },
  { code: "ru", name: "Русский", flag: "🇷🇺", rtl: false },
  { code: "uk", name: "Українська", flag: "🇺🇦", rtl: false },
  { code: "lt", name: "Lietuvių", flag: "🇱🇹", rtl: false },
  { code: "lv", name: "Latviešu", flag: "🇱🇻", rtl: false },
  { code: "et", name: "Eesti", flag: "🇪🇪", rtl: false },
  { code: "ka", name: "ქართული", flag: "🇬🇪", rtl: false },
  { code: "hy", name: "Հայերեն", flag: "🇦🇲", rtl: false },
  { code: "am", name: "አማርኛ", flag: "🇪🇹", rtl: false },
  { code: "sw", name: "Kiswahili", flag: "🇰🇪", rtl: false },
  { code: "ha", name: "Hausa", flag: "🇳🇬", rtl: false },
  { code: "yo", name: "Yorùbá", flag: "🇳🇬", rtl: false },
  { code: "so", name: "Soomaali", flag: "🇸🇴", rtl: false },
];

type Dict = Record<string, Partial<Record<Lang, string>>>;

const dict: Dict = {
  app_name: { ar: "أملاكي", en: "Amlaki", ur: "املاکی", zh: "阿姆拉基", hi: "अमलाकी", bn: "আমলাকি", fr: "Amlaki", es: "Amlaki", tr: "Amlaki" },
  tagline: { ar: "إدارة عقاراتك بذكاء", en: "Manage your properties intelligently", ur: "ذہانت کے ساتھ جائیداد کا انتظام", zh: "智慧管理您的房产", hi: "अपनी संपत्तियों का स्मार्ट प्रबंधन", bn: "বুদ্ধিমত্তার সাথে সম্পত্তি ব্যবস্থাপনা", fr: "Gérez vos biens avec intelligence", es: "Gestione sus propiedades con inteligencia", tr: "Mülklerinizi zekâ ile yönetin", ru: "Управляйте недвижимостью умно", de: "Verwalten Sie Ihre Immobilien intelligent", pt: "Faça a gestão dos seus imóveis com inteligência", it: "Gestisci i tuoi immobili con intelligenza", ja: "知性で不動産を管理", ko: "지성으로 부동산을 관리하세요" },
  create_account: { ar: "إنشاء حساب جديد", en: "Create new account", ur: "نیا اکاؤنٹ بنائیں", zh: "创建新账户", hi: "नया खाता बनाएं", bn: "নতুন অ্যাকাউন্ট তৈরি করুন", fr: "Créer un compte", es: "Crear cuenta", tr: "Hesap oluştur" },
  have_account: { ar: "لدي حساب", en: "I have an account", ur: "میرا اکاؤنٹ ہے", zh: "我已有账户", hi: "मेरा खाता है", bn: "আমার অ্যাকাউন্ট আছে", fr: "J'ai déjà un compte", es: "Ya tengo cuenta", tr: "Hesabım var" },
  email: { ar: "البريد الإلكتروني", en: "Email", ur: "ای میل", zh: "邮箱", hi: "ईमेल", bn: "ইমেইল", fr: "E-mail", es: "Correo", tr: "E-posta" },
  password: { ar: "كلمة المرور", en: "Password", ur: "پاس ورڈ", zh: "密码", hi: "पासवर्ड", bn: "পাসওয়ার্ড", fr: "Mot de passe", es: "Contraseña", tr: "Şifre" },
  name: { ar: "الاسم", en: "Name", ur: "نام", zh: "姓名", hi: "नाम", bn: "নাম", fr: "Nom", es: "Nombre", tr: "İsim" },
  sign_in: { ar: "تسجيل الدخول", en: "Sign in", ur: "سائن ان", zh: "登录", hi: "साइन इन", bn: "সাইন ইন", fr: "Connexion", es: "Iniciar sesión", tr: "Giriş yap" },
  sign_up: { ar: "إنشاء حساب", en: "Sign up", ur: "سائن اپ", zh: "注册", hi: "साइन अप", bn: "সাইন আপ", fr: "S'inscrire", es: "Registrarse", tr: "Kayıt ol" },
  sign_out: { ar: "تسجيل الخروج", en: "Sign out", ur: "سائن آؤٹ", zh: "退出", hi: "साइन आउट", bn: "সাইন আউট", fr: "Déconnexion", es: "Cerrar sesión", tr: "Çıkış" },
  good_morning: { ar: "صباح الخير", en: "Good morning", ur: "صبح بخیر", zh: "早上好", hi: "सुप्रभात", bn: "সুপ্রভাত", fr: "Bonjour", es: "Buenos días", tr: "Günaydın" },
  good_afternoon: { ar: "مساء الخير", en: "Good afternoon", ur: "دوپہر بخیر", zh: "下午好", hi: "नमस्कार", bn: "শুভ অপরাহ্ন", fr: "Bon après-midi", es: "Buenas tardes", tr: "İyi günler" },
  good_evening: { ar: "مساء الخير", en: "Good evening", ur: "شام بخیر", zh: "晚上好", hi: "शुभ संध्या", bn: "শুভ সন্ধ্যা", fr: "Bonsoir", es: "Buenas noches", tr: "İyi akşamlar" },
  collected_this_month: { ar: "المحصل هذا الشهر", en: "Collected this month", ur: "اس مہینے جمع", zh: "本月收款", hi: "इस महीने एकत्र", bn: "এই মাসে সংগৃহীত", fr: "Collecté ce mois", es: "Cobrado este mes", tr: "Bu ay tahsil" },
  buildings: { ar: "المباني", en: "Buildings", ur: "عمارتیں", zh: "建筑", hi: "इमारतें", bn: "ভবন", fr: "Bâtiments", es: "Edificios", tr: "Binalar" },
  units: { ar: "الوحدات", en: "Units", ur: "یونٹس", zh: "单元", hi: "इकाइयां", bn: "ইউনিট", fr: "Unités", es: "Unidades", tr: "Birimler" },
  overdue: { ar: "متأخر", en: "Overdue", ur: "تاخیر", zh: "逾期", hi: "बकाया", bn: "মেয়াদোত্তীর্ণ", fr: "En retard", es: "Vencido", tr: "Gecikmiş" },
  expiring: { ar: "ينتهي قريباً", en: "Expiring", ur: "ختم ہونے والا", zh: "即将到期", hi: "समाप्त हो रहा", bn: "মেয়াদ শেষ হচ্ছে", fr: "Expire bientôt", es: "Por vencer", tr: "Bitmek üzere" },
  pending: { ar: "المتبقي", en: "Pending", ur: "زیر التواء", zh: "待付", hi: "लंबित", bn: "মুলতুবি", fr: "En attente", es: "Pendiente", tr: "Beklemede" },
  dashboard: { ar: "الرئيسية", en: "Dashboard", ur: "ڈیش بورڈ", zh: "首页", hi: "डैशबोर्ड", bn: "ড্যাশবোর্ড", fr: "Tableau", es: "Panel", tr: "Panel" },
  tenants: { ar: "المستأجرون", en: "Tenants", ur: "کرایہ دار", zh: "租户", hi: "किरायेदार", bn: "ভাড়াটে", fr: "Locataires", es: "Inquilinos", tr: "Kiracılar" },
  reports: { ar: "التقارير", en: "Reports", ur: "رپورٹس", zh: "报告", hi: "रिपोर्ट", bn: "প্রতিবেদন", fr: "Rapports", es: "Informes", tr: "Raporlar" },
  notifications: { ar: "تنبيهات", en: "Alerts", ur: "اطلاعات", zh: "提醒", hi: "अलर्ट", bn: "সতর্কতা", fr: "Alertes", es: "Alertas", tr: "Uyarılar" },
  payments: { ar: "المدفوعات", en: "Payments", ur: "ادائیگیاں", zh: "付款", hi: "भुगतान", bn: "পেমেন্ট", fr: "Paiements", es: "Pagos", tr: "Ödemeler" },
  search: { ar: "بحث", en: "Search", ur: "تلاش", zh: "搜索", hi: "खोज", bn: "খুঁজুন", fr: "Rechercher", es: "Buscar", tr: "Ara" },
  add_first_building: { ar: "أضف أول مبنى لك", en: "Add your first building", ur: "اپنی پہلی عمارت شامل کریں", zh: "添加您的第一栋建筑", hi: "अपनी पहली इमारत जोड़ें", bn: "প্রথম ভবন যোগ করুন", fr: "Ajoutez votre premier bâtiment", es: "Agrega tu primer edificio", tr: "İlk binanızı ekleyin" },
  add_building: { ar: "إضافة مبنى", en: "Add building", ur: "عمارت شامل کریں", zh: "添加建筑", hi: "इमारत जोड़ें", bn: "ভবন যোগ করুন", fr: "Ajouter un bâtiment", es: "Agregar edificio", tr: "Bina ekle" },
  empty_buildings_msg: { ar: "ابدأ بإضافة مبناك الأول لإدارة الوحدات والمستأجرين بسهولة.", en: "Start by adding your first building to manage units and tenants with ease.", ur: "اپنی پہلی عمارت شامل کر کے شروع کریں۔", zh: "添加您的第一栋建筑开始管理。", hi: "प्रबंधन शुरू करने के लिए पहली इमारत जोड़ें।", bn: "প্রথম ভবন যোগ করে শুরু করুন।", fr: "Commencez en ajoutant votre premier bâtiment.", es: "Comienza agregando tu primer edificio.", tr: "İlk binanızı ekleyerek başlayın." },
  language: { ar: "اللغة", en: "Language", ur: "زبان", zh: "语言", hi: "भाषा", bn: "ভাষা", fr: "Langue", es: "Idioma", tr: "Dil", ru: "Язык", de: "Sprache", pt: "Idioma", it: "Lingua", ja: "言語", ko: "언어", fa: "زبان", he: "שפה" },
  currency: { ar: "العملة", en: "Currency", ur: "کرنسی", zh: "货币", hi: "मुद्रा", bn: "মুদ্রা", fr: "Devise", es: "Moneda", tr: "Para birimi" },
  settings: { ar: "الإعدادات", en: "Settings", ur: "ترتیبات", zh: "设置", hi: "सेटिंग्स", bn: "সেটিংস", fr: "Paramètres", es: "Ajustes", tr: "Ayarlar" },
  welcome: { ar: "أهلاً بك", en: "Welcome", ur: "خوش آمدید", zh: "欢迎", hi: "स्वागत है", bn: "স্বাগতম", fr: "Bienvenue", es: "Bienvenido", tr: "Hoş geldiniz" },
  current_plan: { ar: "الخطة الحالية", en: "Current plan", ur: "موجودہ منصوبہ", zh: "当前套餐", hi: "वर्तमान योजना", bn: "বর্তমান পরিকল্পনা", fr: "Plan actuel", es: "Plan actual", tr: "Mevcut plan" },
  free: { ar: "مجاني", en: "Free", ur: "مفت", zh: "免费", hi: "मुफ़्त", bn: "ফ্রি", fr: "Gratuit", es: "Gratis", tr: "Ücretsiz" },
  loading: { ar: "جاري التحميل...", en: "Loading...", ur: "لوڈ ہو رہا ہے...", zh: "加载中...", hi: "लोड हो रहा है...", bn: "লোড হচ্ছে...", fr: "Chargement...", es: "Cargando...", tr: "Yükleniyor..." },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
  rtl: boolean;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("amlaki_lang") as Lang) || "ar");

  const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.rtl ? "rtl" : "ltr";
    localStorage.setItem("amlaki_lang", lang);
  }, [lang, meta.rtl]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (k: string) => dict[k]?.[lang] ?? dict[k]?.en ?? k;

  return <I18nContext.Provider value={{ lang, setLang, t, rtl: meta.rtl }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
};
