import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/FileUpload";
import { FieldHelp } from "@/components/ui/FieldHelp";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unit: any;
  onDone: () => void;
}

export function NewTenancyDialog({ open, onOpenChange, unit, onDone }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [contractType, setContractType] = useState("yearly");
  const [rent, setRent] = useState("");
  const [rentType, setRentType] = useState("monthly");
  const [dueDay, setDueDay] = useState("1");
  const [rentTiming, setRentTiming] = useState<"advance" | "arrears">("advance");

  const [deposit, setDeposit] = useState("0");
  const [idImageUrl, setIdImageUrl] = useState<string | null>(null);
  const [contractFileUrl, setContractFileUrl] = useState<string | null>(null);
  const [unitPhotos, setUnitPhotos] = useState<string[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  // المتأخرات الافتتاحية — يتم توزيعها تلقائياً على الأشهر السابقة (نفس منطق AddUnitDialog).
  const [arrears, setArrears] = useState<string>("0");
  // مدفوع حتى (اختياري): تاريخ آخر شهر تم سداده فعلاً قبل بداية هذا العقد —
  // المتأخرات تبدأ مباشرة بعد هذا التاريخ، ولا يُحتسب أي شيء قبله.
  const [paidUpTo, setPaidUpTo] = useState<string>("");
  // أيام السماح بعد يوم الاستحقاق قبل أن يصبح العقد متأخراً.
  const [graceDays, setGraceDays] = useState<string>("0");
  // الرقم الرسمي للعقد من الجهة الحكومية (بلدية / سند) — اختياري.
  const [officialNumber, setOfficialNumber] = useState<string>("");
  const guard = useUnsavedGuard({ open, onOpenChange });
  const lastExtractedRef = useRef<string | null>(null);


  const extractFromId = async () => {
    if (!idImageUrl) return;
    setExtracting(true);
    try {
      const { data: signed, error: sErr } = await supabase.storage
        .from("tenant-ids").createSignedUrl(idImageUrl, 300);
      if (sErr || !signed?.signedUrl) throw new Error(sErr?.message || "signed url failed");
      const { data, error } = await supabase.functions.invoke("extract-id", {
        body: { imageUrl: signed.signedUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      let filled = 0;
      if (data?.name && !name.trim()) { setName(data.name); filled++; }
      if (data?.id_number && !idNumber.trim()) { setIdNumber(data.id_number); filled++; }
      if (data?.email && !email.trim()) { setEmail(data.email); filled++; }
      toast.success(lang === "ar" ? `تم استخراج ${filled} حقول` : `Extracted ${filled} fields`);
    } catch (e: any) {
      toast.error(e.message || (lang === "ar" ? "فشل الاستخراج" : "Extraction failed"));
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    if (!open || !unit) return;
    setName(""); setPhone(""); setEmail(""); setIdNumber("");
    setStartDate(today); setEndDate("");
    setContractType("yearly");
    setRent(String(unit.rent_amount || ""));
    setRentType(unit.rent_type || "monthly");
    setDueDay(String(unit.due_day || 1));
    setRentTiming(((unit as any).rent_timing === "arrears" ? "arrears" : "advance"));

    setDeposit("0");
    setIdImageUrl(null);
    setContractFileUrl(null);
    setUnitPhotos([]);
    setPendingPhoto(null);
    setArrears("0");
    setPaidUpTo("");
    setGraceDays(String(unit.grace_days ?? "0"));
    setOfficialNumber("");
    lastExtractedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.id]);

  // استخراج تلقائي فور رفع صورة/PDF جديد للهوية — بدون زر.
  useEffect(() => {
    if (!idImageUrl) return;
    if (lastExtractedRef.current === idImageUrl) return;
    lastExtractedRef.current = idImageUrl;
    extractFromId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idImageUrl]);


  // When a new unit photo finishes uploading, push to array and reset slot
  useEffect(() => {
    if (pendingPhoto) {
      setUnitPhotos((prev) => [...prev, pendingPhoto]);
      setPendingPhoto(null);
    }
  }, [pendingPhoto]);

  const removePhoto = async (path: string) => {
    await supabase.storage.from("unit-photos").remove([path]);
    setUnitPhotos((prev) => prev.filter((p) => p !== path));
  };

  const submit = async () => {
    if (!unit) return;
    if (!name.trim()) return toast.error(lang === "ar" ? "اسم المستأجر مطلوب" : "Tenant name required");
    setSaving(true);

    // GUARD: refuse to start a new lease while one is still active on this
    // unit. The DB partial-unique index would reject this anyway, but the
    // explicit check lets us surface a friendly Arabic message instead of a
    // raw constraint error and keeps a half-saved state from happening.
    const { data: existingActive } = await supabase
      .from("tenancies").select("id, tenant_name").eq("unit_id", unit.id).eq("status", "active").maybeSingle();
    if (existingActive) {
      setSaving(false);
      return toast.error(
        lang === "ar"
          ? `يوجد عقد نشط لـ ${(existingActive as any).tenant_name || "مستأجر سابق"}. أنهِ العقد الحالي أولاً.`
          : `An active lease for ${(existingActive as any).tenant_name || "the previous tenant"} still exists. End it first.`
      );
    }

    const rentNum = Number(rent) || 0;
    const dueNum = startDate ? Math.min(28, Math.max(1, new Date(startDate).getDate() || 1)) : Math.min(31, Math.max(1, Number(dueDay) || 1));
    const depositNum = Number(deposit) || 0;
    const graceNum = Math.max(0, Math.min(30, Math.floor(Number(graceDays) || 0)));
    const paidUpToVal = paidUpTo || null;
    const { data: insertedTenancy, error: tErr } = await supabase.from("tenancies").insert({
      building_id: unit.building_id,
      unit_id: unit.id,
      tenant_name: name.trim(),
      tenant_phone: phone.trim() || null,
      tenant_email: email.trim() || null,
      tenant_id_number: idNumber.trim() || null,
      tenant_id_image_url: idImageUrl,
      contract_start_date: startDate,
      contract_end_date: endDate || null,
      contract_type: contractType,
      rent_amount: rentNum,
      rent_type: rentType,
      due_day: dueNum,
      security_deposit: depositNum,
      paid_up_to: paidUpToVal,
      grace_days: graceNum,
      deposit_status: depositNum > 0 ? "held" : "none",
      status: "active",
      official_contract_number: officialNumber.trim() || null,
    } as any).select("contract_number").single();
    if (tErr) { setSaving(false); return toast.error(tErr.message); }
    const generatedContractNo = (insertedTenancy as any)?.contract_number || null;


    const updatePayload: any = {
      tenant_name: name.trim(),
      tenant_phone: phone.trim() || null,
      tenant_email: email.trim() || null,
      tenant_id_number: idNumber.trim() || null,
      contract_start_date: startDate,
      contract_end_date: endDate || null,
      contract_type: contractType,
      rent_amount: rentNum,
      rent_type: rentType,
      due_day: dueNum,
      rent_timing: rentTiming,
      grace_days: graceNum,
      paid_up_to: paidUpToVal,
      security_deposit: depositNum,
      deposit_status: depositNum > 0 ? "held" : "none",
      status: "soon",
    };
    if (idImageUrl) updatePayload.tenant_id_image_url = idImageUrl;
    if (contractFileUrl) updatePayload.contract_file_url = contractFileUrl;
    if (unitPhotos.length > 0) {
      const existing = Array.isArray(unit.handover_photos) ? unit.handover_photos : [];
      updatePayload.handover_photos = [...existing, ...unitPhotos];
    }

    // المتأخرات الافتتاحية: تُوزَّع تلقائياً على الأشهر السابقة بنفس منطق AddUnitDialog.
    // months = round(arrears / rent), opening_balance_date = اليوم − months × دورة.
    const arrN = parseFloat(arrears) || 0;
    if (arrN > 0 && rentNum > 0 && rentType === "monthly") {
      // نستخدم floor كي يظل المجموع = arrN بالضبط (أشهر كاملة + باقي).
      const months = Math.floor(arrN / rentNum);
      const remainder = Math.max(0, arrN - months * rentNum);
      const monthsBack = rentTiming === "arrears" ? months : Math.max(0, months - 1);
      const today = new Date();
      const anchor = new Date(today.getFullYear(), today.getMonth() - monthsBack, dueNum);
      const iso = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`;
      updatePayload.opening_balance = remainder;
      updatePayload.opening_balance_date = iso;
    } else if (arrN > 0) {
      updatePayload.opening_balance = arrN;
      updatePayload.opening_balance_date = startDate || new Date().toISOString().slice(0, 10);
    }



    const { error: uErr } = await supabase.from("units").update(updatePayload).eq("id", unit.id);
    setSaving(false);
    if (uErr) return toast.error(uErr.message);

    logActivity({
      entityType: "tenant",
      action: "created",
      entityId: unit.id,
      entityLabel: name.trim(),
      buildingId: unit.building_id,
      descriptionAr: `تسجيل عقد إيجار جديد للمستأجر ${name.trim()} — وحدة ${unit.unit_number}`,
      descriptionEn: `New lease registered for ${name.trim()} — unit ${unit.unit_number}`,
      changes: { rent_amount: rentNum, contract_type: contractType, start: startDate, end: endDate || null },
    });
    toast.success(
      generatedContractNo
        ? (lang === "ar"
            ? `تم إنشاء العقد رقم ${generatedContractNo}`
            : `Lease ${generatedContractNo} created`)
        : t2("tenancy_started_ok")
    );

    const { paymentsBus } = await import("@/lib/paymentsBus");
    paymentsBus.emit(unit.id);
    guard.markSaved();
    onOpenChange(false);
    onDone();
  };

  if (!unit) return null;

  const pathPrefix = `${unit.building_id}/${unit.id}`;

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sage-600">{t2("new_tenant")} — {unit.unit_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3" {...guard.formProps}>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("tenant_name")} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border-sage-200 h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("tenant_phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
                ID
                <FieldHelp content={lang === "ar" ? "رقم الهوية الوطنية / الإقامة / جواز السفر. يُستخرج تلقائياً عند رفع صورة الهوية." : "National ID / residency / passport number. Auto-extracted when you upload the ID image."} />
              </Label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-sage-200 h-11" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("contract_start_date")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
                {t2("contract_end")}
                <FieldHelp content={lang === "ar" ? "تاريخ انتهاء العقد. اتركه فارغاً إن لم يكن محدداً — يمكن إضافته لاحقاً." : "Contract end date. Leave empty if open-ended — you can set it later."} />
              </Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_amount")}</Label>
              <Input type="number" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500 inline-flex items-center gap-1">
                {t2("rent_type")}
                <FieldHelp content={lang === "ar" ? "شهري: يدفع كل شهر. يومي: يحتسب بالأيام (للوحدات اليومية). سنوي: دفعة سنوية." : "Monthly: pays monthly. Daily: per night (daily rentals). Yearly: one annual payment."} />
              </Label>
              <Select value={rentType} onValueChange={setRentType}>
                <SelectTrigger className="rounded-xl border-sage-200 h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t2("monthly")}</SelectItem>
                  <SelectItem value="daily">{t2("daily")}</SelectItem>
                  <SelectItem value="yearly">{t2("yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "تأمين" : "Deposit"}</Label>
              <Input type="number" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "أيام السماح" : "Grace days"}</Label>
              <Input type="number" inputMode="numeric" min={0} max={30} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
          </div>

          {/* مدفوع حتى — اختياري: تاريخ آخر شهر سُدِّد فعلاً قبل بدء هذا العقد */}
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">
              {lang === "ar" ? "مدفوع حتى (اختياري)" : "Paid up to (optional)"}
            </Label>
            <Input
              type="date"
              value={paidUpTo}
              onChange={(e) => setPaidUpTo(e.target.value)}
              className="rounded-xl border-sage-200 h-11"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {lang === "ar"
                ? "تاريخ آخر شهر سُدِّد فعلاً. تبدأ المتأخرات بعد هذا التاريخ — يُغني عن إدخال الإيصالات القديمة."
                : "Last date already paid. Arrears start the day after — no need to enter old receipts."}
            </p>
          </div>

          {/* الرقم الرسمي للعقد — اختياري */}
          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">
              {lang === "ar" ? "الرقم الرسمي للعقد (اختياري)" : "Official contract number (optional)"}
            </Label>
            <Input
              value={officialNumber}
              onChange={(e) => setOfficialNumber(e.target.value)}
              placeholder={lang === "ar" ? "مثال: رقم بلدية / سند" : "e.g. municipality / sanad #"}
              className="rounded-xl border-sage-200 h-11"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {lang === "ar"
                ? "رقم الجهة الحكومية إن وُجد. الرقم الداخلي يُولَّد تلقائياً بعد الحفظ."
                : "Government registration number if any. An internal lease number is generated automatically."}
            </p>
          </div>




          <div className="space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("rent_timing")}</Label>
            <div className="flex gap-1.5">
              {(["advance", "arrears"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setRentTiming(m)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                    rentTiming === m ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                  }`}>{t2(m === "advance" ? "rent_timing_advance" : "rent_timing_arrears")}</button>
              ))}
            </div>
            <p className="text-[11px] text-sage-500 leading-relaxed">
              {t2(rentTiming === "advance" ? "rent_timing_advance_hint" : "rent_timing_arrears_hint")}
            </p>
            <p className="text-[11px] text-sage-400 leading-relaxed">
              ⓘ {t2("due_auto_hint")}
            </p>
          </div>

          {/* المتأخرات الافتتاحية — يُحوَّل المبلغ تلقائياً إلى عدد أشهر متأخرة */}
          <div className="pt-2 border-t border-sage-100 space-y-1.5">
            <Label className="text-xs text-sage-500">{t2("arrears_amount")}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.001"
              value={arrears}
              onChange={(e) => setArrears(e.target.value)}
              onBlur={() => { if (!arrears) setArrears("0"); }}
              placeholder="0"
              className="rounded-xl border-sage-200 bg-card h-11"
            />
            <p className="text-[11px] text-muted-foreground">{t2("arrears_hint")}</p>
            {(() => {
              const arrN = parseFloat(arrears) || 0;
              const rentN = Number(rent) || 0;
              if (!(arrN > 0 && rentN > 0 && rentType === "monthly")) return null;
              const months = Math.max(1, Math.round(arrN / rentN));
              const remainder = Math.max(0, arrN - months * rentN);
              const AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
              const EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const names = lang === "ar" ? AR : EN;
              const dueInt = Math.min(28, Math.max(1, startDate ? new Date(startDate).getDate() : Number(dueDay) || 1));
              const monthsBack = rentTiming === "arrears" ? months : Math.max(0, months - 1);
              const today = new Date();
              const list: string[] = [];
              for (let i = 0; i < months; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - monthsBack + i, dueInt);
                list.push(`${names[d.getMonth()]} ${d.getFullYear()}`);
              }
              return (
                <div className="mt-2 rounded-xl border border-sage-200 bg-sage-50/60 px-2.5 py-2 text-[11px] text-sage-600">
                  <p className="font-bold">
                    {lang === "ar"
                      ? `= ${months} ${months === 1 ? "شهر متأخّر" : months === 2 ? "شهران متأخّران" : "أشهر متأخّرة"}`
                      : `= ${months} overdue ${months === 1 ? "month" : "months"}`}
                  </p>
                  <p className="mt-0.5 opacity-80 leading-relaxed">{list.join(" · ")}</p>
                  {remainder > 0.009 && (
                    <p className="mt-1 text-terracotta font-semibold">
                      {lang === "ar" ? `+ رصيد جزئي ${remainder.toFixed(3)}` : `+ partial ${remainder.toFixed(3)}`}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>




          {/* Optional attachments */}
          <div className="pt-2 border-t border-sage-200/50 space-y-3">
            <p className="text-xs font-bold text-sage-600">
              {lang === "ar" ? "المرفقات (اختياري)" : "Attachments (optional)"}
            </p>

            <FileUpload
              bucket="tenant-ids"
              pathPrefix={pathPrefix}
              value={idImageUrl}
              onChange={setIdImageUrl}
              accept="application/pdf,image/*"
              maxSizeMB={10}
              label={lang === "ar" ? "صورة الهوية أو ملف PDF" : "ID image or PDF"}
              isPrivate
            />
            {idImageUrl && extracting && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sage-50 border border-sage-200/60 text-sage-700 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{lang === "ar" ? "جاري قراءة الهوية..." : "Reading ID..."}</span>
              </div>
            )}

            <FileUpload
              bucket="contracts"
              pathPrefix={pathPrefix}
              value={contractFileUrl}
              onChange={setContractFileUrl}
              accept="application/pdf,image/*"
              maxSizeMB={15}
              label={lang === "ar" ? "ملف العقد (PDF)" : "Contract file (PDF)"}
              isPrivate
            />

            <div className="space-y-2">
              <p className="text-xs font-bold text-sage-600">
                {lang === "ar" ? "صور الوحدة" : "Unit photos"}
              </p>
              {unitPhotos.length > 0 && (
                <div className="space-y-1.5">
                  {unitPhotos.map((p) => (
                    <div key={p} className="flex items-center gap-2 p-2 rounded-xl bg-sage-100/50 border border-sage-200/40">
                      <ImageIcon className="h-4 w-4 text-sage-500" />
                      <span className="flex-1 text-xs text-sage-600 truncate">{p.split("/").pop()}</span>
                      <button type="button" onClick={() => removePhoto(p)} className="text-burgundy hover:opacity-70" aria-label="remove">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <FileUpload
                bucket="unit-photos"
                pathPrefix={pathPrefix}
                value={null}
                onChange={(v) => v && setPendingPhoto(v)}
                accept="image/*"
                maxSizeMB={8}
                label={lang === "ar" ? "إضافة صورة وحدة" : "Add unit photo"}
                isPrivate
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button data-guard-ignore variant="outline" onClick={() => guard.handleOpenChange(false)} className="rounded-xl">{t2("cancel")}</Button>
          <Button data-guard-ignore onClick={submit} disabled={saving} className="rounded-xl bg-gradient-sage text-primary-foreground">{t2("save")}</Button>
        </DialogFooter>
        {guard.ConfirmDiscardUI}
      </DialogContent>
    </Dialog>
  );
}
