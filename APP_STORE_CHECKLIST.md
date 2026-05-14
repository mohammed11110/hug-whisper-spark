# 📱 قائمة تدقيق نشر "أملاكي" على App Store

دليل عملي خطوة بخطوة لنشر التطبيق على متجر آبل وجوجل بلاي.

---

## ✅ ما تم إنجازه داخل المشروع

- [x] إضافة Capacitor (`@capacitor/core`, `ios`, `android`, `splash-screen`, `cli`, `assets`)
- [x] إنشاء `capacitor.config.ts` مع `appId` و `appName`
- [x] ميزة **حذف الحساب** (إعدادات → منطقة الخطر) — شرط إلزامي من Apple
- [x] Edge Function آمنة `delete-account` تحذف كل البيانات وحساب المصادقة
- [x] أيقونة 1024×1024 (`resources/icon.png`)
- [x] شاشة بداية (`resources/splash.png`)
- [x] إخفاء شارة Lovable في النسخة المنشورة
- [x] صفحات الشروط والخصوصية وسياسة الاسترجاع موجودة

---

## 🛠️ خطوات التحضير على جهاز Mac

> **متطلبات:** جهاز Mac + Xcode (مجاناً من Mac App Store) + حساب Apple Developer (99 USD/سنة).

### 1) تصدير المشروع وسحبه
```bash
# في Lovable: اضغط GitHub → Connect / Create Repository
git clone <your-repo-url>
cd <your-repo>
npm install
```

### 2) قبل البناء النهائي للنشر
في `capacitor.config.ts` **احذف بلوك `server`** كله — لأنه للتطوير فقط:
```ts
// احذف هذا قبل البناء للمتجر
server: {
  url: "...",
  cleartext: true,
},
```

### 3) توليد الأيقونات والـ Splash لكل المقاسات
```bash
npx capacitor-assets generate --iconBackgroundColor '#faf6ee' --iconBackgroundColorDark '#1a1a1a' --splashBackgroundColor '#faf6ee' --splashBackgroundColorDark '#1a1a1a'
```
> هذا يستخدم `resources/icon.png` و `resources/splash.png` ويولّد كل المقاسات تلقائياً.

### 4) إضافة منصة iOS
```bash
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios
```
يفتح Xcode تلقائياً.

### 5) إعدادات Xcode الأساسية
- **General → Identity:**
  - Display Name: `أملاكي` أو `Amlaki`
  - Bundle Identifier: `app.lovable.c6fcf97d71d44c46b75687a26fc2bf21` (أو غيّره لـ `com.yourname.amlaki`)
  - Version: `1.0.0` — Build: `1`
- **Signing & Capabilities:** اختر فريق Apple Developer الخاص بك
- **Deployment Info:** iOS 14.0 أو أحدث

### 6) إنشاء سجل التطبيق في App Store Connect
- ادخل [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- My Apps → + → New App
- Platform: iOS · Name: `أملاكي - Amlaki` · Primary Language: Arabic
- Bundle ID: نفسه أعلاه · SKU: `amlaki-001`

### 7) رفع البناء إلى App Store
في Xcode:
- Product → Archive (يجب اختيار "Any iOS Device" كهدف)
- بعد الانتهاء: Window → Organizer → Distribute App → App Store Connect → Upload

---

## 📝 معلومات المتجر الجاهزة

### العنوان (30 حرفاً كحد أقصى)
- 🇸🇦 `أملاكي - إدارة العقارات`
- 🇺🇸 `Amlaki — Property Manager`

### العنوان الفرعي (30 حرف)
- 🇸🇦 `إدارة المباني والإيجارات`
- 🇺🇸 `Buildings, Tenants & Rents`

### الكلمات المفتاحية (100 حرف، مفصولة بفواصل بدون مسافات)
```
عقارات,إيجار,مستأجرين,مباني,شقق,أملاك,محاسبة,property,rent,tenant,landlord,real estate,lease
```

### الفئة
- Primary: **Business**
- Secondary: **Finance**

### تصنيف العمر
**4+** (لا يحتوي على محتوى حساس)

### الوصف (عربي)
```
أملاكي — تطبيق متكامل لإدارة العقارات للملّاك ومدراء المباني.

✦ المزايا الرئيسية:
• إدارة المباني والوحدات والمستأجرين في مكان واحد
• تسجيل الإيجارات والدفعات وتوليد الإيصالات بصيغة PDF
• تنبيهات تلقائية للإيجارات المستحقة والمتأخرة
• تقارير مالية وإحصائيات شاملة لكل مبنى
• دعم تعدد العملات و9 لغات
• مساعد ذكي للإجابة على استفساراتك
• نسخ احتياطي آمن في السحابة
• إدارة فريق العمل بصلاحيات متعددة (مالك، محاسب، مشاهد)
• واجهة أنيقة بدعم كامل للعربية واللغات اليمينية

تطبيق أملاكي مصمم خصيصاً للملّاك ومدراء العقارات لتوفير الوقت وتنظيم العمل.
```

### الوصف (إنجليزي)
```
Amlaki is the complete property management app for landlords and property managers.

✦ Key features:
• Manage buildings, units and tenants in one place
• Record rents, payments and generate PDF receipts
• Automatic reminders for due and overdue rent
• Comprehensive financial reports per building
• Multi-currency and 9-language support
• Smart AI assistant
• Secure cloud backups
• Team management with role-based permissions
• Beautiful UI with full RTL support

Built for landlords and property managers — save time, stay organized.
```

### "ما الجديد" (لأول إصدار)
- 🇸🇦 `الإصدار الأول من أملاكي 🎉`
- 🇺🇸 `First release of Amlaki 🎉`

### روابط مطلوبة
- **Privacy Policy URL:** `https://amlaki1.app/privacy`
- **Terms of Use (EULA):** `https://amlaki1.app/terms`
- **Support URL:** `https://amlaki1.app` (أو أنشئ صفحة دعم/إيميل)
- **Marketing URL:** `https://amlaki1.app`

### حساب اختباري للمراجع (مهم جداً)
أنشئ مستخدماً تجريبياً وأدخل بياناته في **App Review Information**:
```
البريد: review@amlaki1.app
كلمة المرور: Review2026!
```

### ملاحظات للمراجع (Review Notes)
```
- App is in Arabic (primary) and English.
- To test: sign in with the demo account above.
- Account deletion is available in: Settings → Danger zone → Delete account.
- This app does not include in-app purchases at launch.
- All data is stored in our backend. Users can export and delete it.
```

---

## 📸 لقطات الشاشة المطلوبة

### iPhone (إلزامي)
- **6.7" (iPhone 15 Pro Max):** 1290 × 2796 — على الأقل 3 صور
- **6.5" (iPhone 11 Pro Max):** 1242 × 2688 — على الأقل 3 صور
- **5.5" (iPhone 8 Plus):** 1242 × 2208 — على الأقل 3 صور

### iPad (إن دعمت iPad)
- **12.9" (iPad Pro):** 2048 × 2732
- **6th gen 12.9":** 2048 × 2732

> 💡 **نصيحة:** صوّر الشاشات من الـ Simulator في Xcode بأحجام مختلفة (Cmd+S في المحاكي).
>
> الشاشات الموصى بها: لوحة التحكم · قائمة المباني · تفاصيل وحدة · شاشة المدفوعات · التقارير.

---

## 🔐 نقاط Apple التي ترفض بسببها

| المتطلب | الحالة |
|---------|--------|
| حذف الحساب من داخل التطبيق | ✅ موجود |
| سياسة الخصوصية | ✅ موجودة |
| شروط الاستخدام (EULA) | ✅ موجودة |
| دعم تسجيل الدخول الآمن | ✅ Email + Google + Apple (متاح في Lovable Cloud) |
| لا يطلب أذونات بدون مبرر | ✅ |
| لا يحتوي على محتوى Lovable Badge | ✅ تم الإخفاء |
| تجربة كاملة في حساب المراجعة | ⚠️ أنشئ الحساب التجريبي قبل الإرسال |
| App Tracking Transparency (إن استخدمت تتبعاً) | ➖ غير مطلوب حالياً |

---

## 🤖 لمتجر Google Play (لاحقاً)

- حساب Google Play Developer (25 USD مرة واحدة)
- ```bash
  npx cap add android
  npm run build
  npx cap sync android
  npx cap open android
  ```
- في Android Studio: Build → Generate Signed Bundle (.aab)
- ارفع الملف في [play.google.com/console](https://play.google.com/console)
- املأ نفس بيانات المتجر أعلاه + Data Safety + Content Rating

---

## 💰 ملخص التكاليف
| البند | التكلفة |
|------|---------|
| Apple Developer Program | 99 USD/سنة |
| Google Play Developer | 25 USD مرة واحدة |
| Mac (إن لم يتوفر) | 700-1500 USD أو خدمة سحابية مثل Codemagic ~30 USD/شهر |

---

## ⏱️ المدة المتوقعة
- إعداد Xcode + رفع أول بناء: **2-4 ساعات**
- مراجعة Apple: **1-3 أيام عمل** (يمكن أن تطول لأسبوع لأول إصدار)
- مراجعة Google: **1-3 أيام**

---

## 🆘 عند رفض التطبيق
- اقرأ سبب الرفض في App Store Connect → Resolution Center
- ردّ مباشرة من نفس الشاشة (يفضّل بالإنجليزية)
- أعد رفع بناء جديد إن طُلب إصلاح في الكود

---

**الخطوة التالية:** صدّر المشروع إلى GitHub، ثم اتبع القسم 🛠️ خطوة بخطوة على جهاز Mac.
