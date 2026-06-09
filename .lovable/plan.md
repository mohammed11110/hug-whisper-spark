# الحل الجذري لمشكلة Google على iPhone

## التشخيص المؤكد

الخطأ: `invalid_audience: Audience is not a valid client ID`

السبب: عند تسجيل الدخول بـ Google داخل تطبيق iPhone، الـ Google SDK يُصدر `idToken` يكون فيه حقل `aud` (الجمهور) = **iOS Client ID**:
```
333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com
```

لكن إعدادات الباك-إند الحالية تقبل **Web Client ID فقط**:
```
333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com
```

فعند إرسال الـ idToken إلى `supabase.auth.signInWithIdToken`، يفحص الباك-إند الـ `aud` ويرفضه لأنه غير مُسجَّل ضمن قائمة Client IDs المعتمدة.

الكود من جهة التطبيق سليم بالكامل (Apple يعمل، Google ويب يعمل، nonce صحيح). المشكلة **100% في إعدادات الباك-إند فقط** — لا حاجة لأي تعديل برمجي.

## الحل (خطوة واحدة في الباك-إند)

افتح: **Backend → Authentication → Sign In Methods → Google**

في حقل **Client IDs** (أو Authorized Client IDs)، ضع القيمتين مفصولتين بفاصلة، **والـ Web أولاً**:

```
333958704131-3f0rajm780ophcb2g770apn5hkbto3hq.apps.googleusercontent.com,333958704131-p0345q3rti29e70oesqmgvpah2q8e58a.apps.googleusercontent.com
```

ملاحظات حرجة:
- لا توجد مسافات حول الفاصلة.
- Web Client ID **يجب** أن يكون أولاً (هو المعرف الأساسي للموفِّر).
- iOS Client ID ثانياً ليُقبَل الجمهور القادم من تطبيق الـ iPhone.
- احفظ الإعدادات.

## التحقق

1. بعد الحفظ في الباك-إند، **لا حاجة** لإعادة بناء التطبيق أو `cap sync` — التغيير في السيرفر فقط.
2. أغلق التطبيق على iPhone وافتحه مجدداً.
3. اضغط "المتابعة مع Google" → يجب أن يكتمل تسجيل الدخول مباشرة.

## ماذا لو لم يكتمل بعد التعديل؟

أبلغني برسالة الخطأ الجديدة بالضبط، وسأفحص:
- هل الـ iOS Client ID صحيح في Google Cloud Console (Bundle ID = `com.mohammeddahaish.amlaki`).
- هل ملف `GoogleService-Info.plist` موجود في مشروع Xcode ومُحدَّث.

لكن في 95% من الحالات هذه الخطوة وحدها كافية.
