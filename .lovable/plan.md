## الهدف
تطوير نظام إصدار الإيصالات ليطابق القالب الثنائي اللغة المرفق (ذهبي/كحلي/ورقي) مع تأكيد أن كل إعدادات الإصدار (هوية + توقيع) تأتي من السيرفر وتتزامن لحظياً بين الأجهزة.

## الوضع الحالي (ما هو موجود فعلاً)
- جدول `profiles` يحوي بالفعل: `brand_name`, `brand_logo_path`, `brand_phone`, `brand_address`, `brand_landlord_name`, `brand_landlord_name_en`, `signature_path`, `signature_updated_at`.
- `brand.ts` + `signature.ts` يرفعان للـ Storage (buckets `branding` و `signatures`) ويتزامنان عبر Realtime على تغيّرات `profiles`.
- `receipt_counters` + RPC `allocate_receipt_numbers` يولّدان أرقاماً ذرّية على السيرفر.
- `pdfDocs.ts` يبني إيصال PDF حالياً بخط Noto Kufi Arabic + Outfit مضمَّن.

## الفجوات
1. **حقول مفقودة في `profiles`**: `cr_number` (السجل التجاري)، `brand_name_en` (اسم إنجليزي مستقل)، `default_currency` (افتراضي OMR). الموقّع نستخدم الحقلين الموجودين `brand_landlord_name` / `brand_landlord_name_en`.
2. **قالب الإيصال الحالي** أحادي اللغة ولا يطابق الهوية الجديدة (ذهبي/كحلي/شريط مبلغ/مبلغ كتابةً ثنائي).
3. **حارس الإصدار**: لا يوجد فحص يمنع الإصدار قبل اكتمال الإعدادات (شعار + توقيع + اسم).
4. **«المبلغ كتابةً» بالإنجليزية** غير موجود.

## التغييرات المقترحة

### 1) Migration: إضافة الحقول الناقصة على `profiles`
- `cr_number TEXT`
- `brand_name_en TEXT`
- `default_currency TEXT DEFAULT 'OMR'`

(لا حاجة لجدول `company_settings` منفصل — `profiles` يلعب نفس الدور بالفعل مع RLS صحيحة ومزامنة Realtime مفعّلة.)

### 2) `src/lib/brand.ts`
- إضافة الحقول الجديدة إلى `BusinessBrand` + `loadBrand` + `saveBrandFields`.

### 3) `src/lib/appSettings.tsx`
- توسيع `BusinessBrand` بالحقول: `nameEn`, `crNumber`, `defaultCurrency`.
- تمرير القيم في كل دورات الحفظ/التحميل.

### 4) `src/components/SettingsPanel.tsx` (أو قسم البراند)
- إضافة حقول: «الاسم بالإنجليزية»، «رقم السجل التجاري»، «العملة الافتراضية».
- إبقاء قسم رفع الشعار/التوقيع كما هو (يعمل).

### 5) `src/lib/numberToWords.ts` (جديد)
- دالة `amountToWordsAr(amount, currency)` ودالة `amountToWordsEn(amount, currency)` (مع التعامل مع البيسة — 3 خانات عشرية).

### 6) `src/lib/pdfDocs.ts` — إعادة بناء `buildReceiptHTML`
- تطبيق القالب المرفق بنفس الألوان والـ tokens:
  - رأس كحلي `#272B3A` + شعار/اسم/س.ت يمين + عنوان ثنائي يسار + شارة PAID خضراء.
  - شريط meta ثلاثي (رقم، تاريخ بصيغتين، طريقة).
  - صفوف ثنائية اللغة (تسمية AR يمين، EN يسار، القيمة وسط).
  - شريط مبلغ ذهبي `#B8924A` مع ر.ع / OMR.
  - بطاقة «المبلغ كتابةً» بخلفية `#E9DFC8` (سطران AR/EN).
  - صف المتبقي (أخضر إن صفر).
  - بلوك التوقيع: `signature_url` المحفوظ + اسم الموقّع AR · EN.
  - تذييل ثنائي اللغة.
- A4 بالضبط (210×297mm)، أرقام لاتينية للمبلغ، 3 خانات عشرية.
- بدون ختم وبدون توقيع للطرف الآخر (حسب الطلب).

### 7) حارس الإصدار
في كل نقاط الإصدار (`AddPaymentDialog`، زر «إيصال» في تفاصيل الوحدة، إلخ) — قبل استدعاء `downloadReceiptPDFDirect`:
- استدعاء `verifySignatureFresh({ force: true })` و `loadBrand()`.
- إن كان `signature_path` أو `brand_logo_path` أو `brand_name` فارغاً → toast واضح: «أكمل إعدادات الإصدار (الشعار / التوقيع / الاسم) قبل أول إيصال» + زر «فتح الإعدادات».

### 8) Realtime
لا تعديل — `appSettings.tsx` يشترك بالفعل على `UPDATE profiles` ويعيد التحميل. سنتأكد فقط أن أي إضافة للحقول الجديدة تمر عبر نفس مسار `saveBrandFields` ليصل التحديث لجميع الأجهزة فوراً.

## الملفات المتأثرة
- Migration جديدة (إضافة 3 أعمدة على `profiles`)
- `src/lib/brand.ts`
- `src/lib/appSettings.tsx`
- `src/lib/numberToWords.ts` (جديد)
- `src/lib/pdfDocs.ts` (قالب الإيصال فقط)
- `src/components/SettingsPanel.tsx` (حقول جديدة + حارس الإصدار اختيارياً)
- `src/components/AddPaymentDialog.tsx` + أي نقطة إصدار أخرى (حارس)

## خارج النطاق
- لا تعديل على منطق الدفعات أو الأرصدة أو العقود.
- لا تغيير على قوالب PDF الأخرى (عقد/كشف حساب/تقرير).
- لا تغيير على نظام صلاحيات/خطط الاشتراك.

## سؤال واحد قبل التنفيذ
هل تريد إضافة هذه الحقول الجديدة (`cr_number`, `brand_name_en`, `default_currency`) إلى نموذج الإعدادات الحالي، أم تفضّل قسماً مستقلاً اسمه «إعدادات الإصدار» يجمع كل ما يخص الإيصال (شعار/اسم/س.ت/جوال/عنوان/توقيع/عملة) في مكان واحد؟