## الهدف
إضافة 3 خانات اختيارية لرفع الملفات في نافذة "مستأجر جديد" (NewTenancyDialog):
1. صورة الهوية (ID)
2. صور الوحدة (متعددة)
3. ملف العقد PDF

## التغييرات

### 1. `src/components/NewTenancyDialog.tsx`
إضافة 3 حقول رفع ملفات اختيارية باستخدام `FileUpload` الموجود مسبقاً:
- **صورة الهوية** → bucket: `tenant-ids` → يُحفظ في `tenancies.tenant_id_image_url` و `units.tenant_id_image_url`
- **صور الوحدة** (متعددة) → bucket: `unit-photos` → تُضاف إلى `units.handover_photos` (jsonb array)
- **ملف العقد PDF** → bucket: `contracts` → يُحفظ في `units.contract_file_url`

كل الحقول اختيارية — الحفظ يعمل بدونها كما هو الآن.

### 2. لا تغييرات في قاعدة البيانات
الأعمدة موجودة بالفعل:
- `tenancies.tenant_id_image_url` ✓
- `units.tenant_id_image_url`, `units.contract_file_url`, `units.handover_photos` ✓

الـ buckets موجودة: `tenant-ids`, `unit-photos`, `contracts` (كلها خاصة).

### 3. ملاحظات تقنية
- التحقق من سياسات RLS لـ storage على الـ buckets الثلاثة (إن لم تكن موجودة، سأضيف migration للسماح للمالك بالرفع/القراءة ضمن مجلد `{user_id}/...`).
- ترتيب الحفظ: رفع الملفات أولاً → ثم insert في `tenancies` و update في `units` بمسارات الملفات.
- عرض الحقول بشكل مدمج تحت قسم منفصل "المرفقات (اختياري)" في أسفل النموذج قبل أزرار الحفظ.

## النتيجة
المستخدم يستطيع عند إضافة مستأجر جديد إرفاق هوية + صور وحدة + عقد PDF، أو تخطيها كلها والحفظ كالمعتاد.
