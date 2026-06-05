## السبب الجذري

الأخطاء الأربعة (90022 / 90023×2 / 90713) كلها عرض واحد لمشكلة جذرية:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset` فاضي أو ناقص → ما فيه 120×120 (iPhone) ولا 152×152 و167×167 (iPad).
- لذلك Xcode ما يقدر يحقن `CFBundleIconName = AppIcon` في `Info.plist` عند البناء، فيظهر خطأ 90713.
- لاحظ من اللوغ: التطبيق يدعم iPad تلقائياً (`isOptedInToDistributeIosAppOnMacAppStore: true`) لهذا يطلب أيقونات iPad أيضاً.

مجلد `ios/` غير موجود في مستودع Lovable (يُولَّد محلياً عبر `npx cap add ios`)، لذلك الإصلاح يجب أن يتم على جهاز Mac بنفسك. الأوامر `cap:icons` الموجودة في `package.json` صحيحة، لكن لا بد تشغّلها بالترتيب الصحيح.

## الخطوات (شغّلها على Mac داخل مجلد المشروع)

### 1) تأكد من أن أيقونة المصدر سليمة (1024×1024 PNG بدون قناة alpha)
```bash
file resources/icon.png
sips -g pixelWidth -g pixelHeight resources/icon.png
# إذا فيها alpha، احذفها (Apple ترفض الشفافية في أيقونة iOS):
sips -s format png -s formatOptions 100 resources/icon.png --out resources/icon.png
```

### 2) ثبّت التبعيات وأضف منصة iOS إن لم تكن مضافة
```bash
npm install
npx cap add ios   # تخطّاها إن المجلد ios/ موجود
```

### 3) ابنِ الواجهة أولاً قبل أي sync
```bash
npm run build
```

### 4) ولّد الأيقونات (هذا الترتيب مهم — قبل `cap sync`)
```bash
npm run cap:icons:ios
```
هذا يملأ `ios/App/App/Assets.xcassets/AppIcon.appiconset/` بكل المقاسات (40, 58, 60, 80, 87, 120, 152, 167, 180, 1024).

### 5) زامن مشروع iOS
```bash
npx cap sync ios
```

### 6) تحقق يدوياً قبل الأرشفة
```bash
ls ios/App/App/Assets.xcassets/AppIcon.appiconset/
# يجب أن ترى Contents.json + ملفات .png متعددة (AppIcon-120, 152, 167, 1024 ...)

/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" ios/App/App/Info.plist
# يجب أن يطبع: AppIcon
```
إن لم يطبع `AppIcon`، أضفه يدوياً:
```bash
/usr/libexec/PlistBuddy -c "Add :CFBundleIconName string AppIcon" ios/App/App/Info.plist
```

### 7) في Xcode
```bash
npx cap open ios
```
- Product → Clean Build Folder (Shift+Cmd+K)
- اختر هدف **Any iOS Device (arm64)**
- Product → Archive → Distribute App → App Store Connect → Upload

## تفاصيل تقنية (للمرجع)

| الخطأ | الأيقونة الناقصة | المصدر |
|---|---|---|
| 90022 | iPhone 120×120 (@2x 60pt و @3x 40pt) | AppIcon.appiconset |
| 90023 | iPad 152×152 (@2x 76pt) | AppIcon.appiconset |
| 90023 | iPad Pro 167×167 (@2x 83.5pt) | AppIcon.appiconset |
| 90713 | `CFBundleIconName` غير موجود في Info.plist | يُضاف تلقائياً عند وجود AppIcon catalog صحيح |

الأخطاء الشائعة:
- تشغيل `npx cap sync` **قبل** `cap:icons` → الـ appiconset يبقى فارغ.
- استخدام أيقونة فيها alpha channel → `capacitor-assets` يفشل صامتاً لبعض المقاسات.
- نسيان Clean Build Folder بعد تحديث الأيقونات → Xcode يستخدم الكاش القديم.

## ما لن أعدّله في هذا الـ Plan

- لا تغيير على ملفات المستودع — `package.json` يحوي الأوامر اللازمة، و`capacitor.config.ts` صحيح.
- ملفات `ios/` لا تعيش في الريبو (تُولَّد محلياً)، ولا يوجد ما أحرّره داخل Lovable لحل هذه الأخطاء.

إذا أردتني أضيف `prepack` script يربط `cap:icons:ios && cap sync ios` في خطوة واحدة لتجنّب نسيان الترتيب مستقبلاً، أخبرني.
