# ربط بيانات المؤسسة والتوقيع بالحساب

## المشكلة
- **التوقيع الإلكتروني**: مرتبط بالحساب فعلاً (مخزّن في Supabase Storage `signatures/{uid}.png` + `profiles.signature_path`) ✅
- **بيانات المؤسسة** (الاسم، الشعار، الهاتف، العنوان، اسم المالك): مخزّنة فقط في `localStorage` على الجهاز، فلا تظهر عند تسجيل الدخول من جهاز آخر ❌

## الحل
نقل بيانات المؤسسة إلى الحساب بنفس نمط التوقيع.

### 1) قاعدة البيانات
إضافة أعمدة على جدول `profiles`:
- `brand_name`, `brand_phone`, `brand_address`
- `brand_landlord_name`, `brand_landlord_name_en`
- `brand_logo_path` (مرجع داخل bucket `branding`)
- `brand_updated_at`

(Bucket `branding` موجود وعام بالفعل.)

### 2) طبقة البيانات (Frontend)
- `src/lib/appSettings.tsx`: عند تسجيل الدخول، نقرأ `brand` من `profiles` ونحدّث الحالة. عند أي تعديل على `settings.brand` نُزامن مع الخادم (debounced upsert) إضافةً للحفظ المحلي الحالي كـ cache.
- إنشاء helper `src/lib/brand.ts` على نمط `signature.ts`:
  - `loadBrand()` → يقرأ من profile + يحمّل الشعار من bucket `branding` كـ data URL.
  - `saveBrand(patch)` → يحدّث الأعمدة على profile.
  - `uploadBrandLogo(blob)` / `deleteBrandLogo()` → رفع/حذف الشعار في `branding/{uid}.png` وتحديث `brand_logo_path`.
- عند تسجيل الخروج/دخول مستخدم آخر: نمسح الـ cache المحلي ونعيد التحميل من الخادم.

### 3) واجهة الإعدادات
لا تغيير بصري. شاشة إعدادات المؤسسة الحالية ستحفظ على الخادم تلقائياً، مع مؤشّر «تم الحفظ» قصير.

### 4) الترحيل (Migration ذاتي لمرة واحدة)
عند أول تشغيل بعد التحديث: إذا كان لدى المستخدم `brand` في localStorage ولا توجد بيانات على الخادم → نرفعها تلقائياً (بما فيها الشعار من data URL إلى bucket) ثم نعتمد الخادم كمصدر للحقيقة.

## خارج النطاق
- لا تغيير على PDF الإيصال/العقد (يستخدم نفس `settings.brand` فيصبح متزامناً تلقائياً).
- لا تغيير على التوقيع (يعمل بشكل صحيح أصلاً).
- لا تغيير على الترجمة، العملة، السمة (تبقى local — تفضيلات جهاز).

## ملاحظة تقنية
سأنشئ Migration واحدة تضيف أعمدة `brand_*` على `profiles` (الـ RLS الحالية تكفي لأن المستخدم يقرأ/يكتب صفّه فقط).
