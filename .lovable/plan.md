
# إيصال ثنائي اللغة + توقيع إلكتروني محفوظ

> ملاحظة: المشروع React/Vite + Capacitor (وليس Flutter). سأطبّق نفس الفكرة بأدوات الويب المعتمدة: `jsPDF` لتوليد PDF، `Web Share API`/`Capacitor Share` للمشاركة، Supabase Storage لتخزين التوقيع. النتيجة البصرية مطابقة لـ `bilingual_receipt.pdf` المرفق.

---

## 1) الباك‑إند

### 1.1 Bucket التوقيع
- إنشاء bucket خاص اسمه `signatures` (private).
- مسار الملف: `signatures/{user_id}.png` (واحد لكل مستخدم — يُستبدل عند التعديل).
- سياسات RLS على `storage.objects`:
  - `SELECT/INSERT/UPDATE/DELETE` لـ `authenticated` فقط على الملفات التي يبدأ مسارها بـ `auth.uid()::text`.

### 1.2 جدول `profiles` — إضافة عمودَين
- `signature_path text` — مسار الملف داخل البكت (للسرعة، نعرف أنه موجود بدون استدعاء Storage).
- `signature_updated_at timestamptz`.
- لا تغييرات RLS على `profiles` (موجودة).

---

## 2) واجهة التوقيع الإلكتروني (الإعدادات)

ملف جديد: `src/components/SignatureManager.tsx` يُدمج في `src/pages/Settings.tsx` ضمن قسم "الملف الشخصي".

محتوى القسم:
- معاينة التوقيع الحالي (إن وُجد) على خلفية بيضاء + خط ذهبي تحته.
- زر **"رسم التوقيع"** يفتح Dialog فيه `<canvas>` (لمس + ماوس)، أزرار: مسح، تراجع، حفظ. الإخراج PNG شفاف 600×200 (نقطي).
- زر **"رفع صورة"** يقبل PNG/JPG، يفرض حد 1MB، يحوّل JPG لـ PNG شفاف إن أمكن (وإلا يُبقى كما هو على خلفية بيضاء)، ضغط عبر `@/lib/imageCompression`.
- زر **"تعديل"** و**"حذف"** للتوقيع الحالي.
- بعد الحفظ: رفع إلى `signatures/{uid}.png` (upsert) + تحديث `profiles.signature_path` و`signature_updated_at`.

مكتبة الرسم: استخدام `<canvas>` مباشرة (بدون حزمة) — خفيف وكافٍ. خوارزمية smoothing بسيطة (quadraticCurveTo بين النقاط).

### 2.1 Hook موحّد
ملف جديد: `src/lib/signature.ts`
- `getMySignatureUrl()` → يجلب signed URL (مدّة 1 ساعة) ويحوّل لـ dataURL مخزّن في `sessionStorage` (مفتاح `amlaki_sig_dataurl`) — لتجنّب الجلب في كل إيصال.
- `saveSignature(blob)` → upload + update profile + مسح كاش.
- `deleteSignature()` → remove + null في profile + مسح كاش.
- `hasSignature(): Promise<boolean>` — يقرأ `profiles.signature_path`.

---

## 3) مولّد الإيصال ثنائي اللغة

### 3.1 ملف جديد: `src/lib/pdfBilingualReceipt.ts`

مولّد مستقل (يعيش بجانب `pdfDocs.ts` ولا يلمسه). يستخدم `jsPDF` + خطوط `NotoKufiArabic` و`Outfit` المُدمجة فعلياً في `pdfDocs.ts` (سأستوردها من نفس مصدر base64).

**القياس**: A5 portrait (148×210mm) — مطابق للمرفق.

**التركيب** (مطابق حرفياً للـ PDF المرفق):

```
┌──────────────────────────────────────┐
│ شريط علوي كحلي #272B3