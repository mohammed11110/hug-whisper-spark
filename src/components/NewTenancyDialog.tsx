import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/FileUpload";
import { useT2 } from "@/lib/i18n2";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { X, Image as ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { LastPaymentSection, getLastPaidMonthOptions, nextMonthStartISO } from "@/components/LastPaymentSection";

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
  const [deposit, setDeposit] = useState("0");
  const [idImageUrl, setIdImageUrl] = useState<string | null>(null);
  const [contractFileUrl, setContractFileUrl] = useState<string | null>(null);
  const [unitPhotos, setUnitPhotos] = useState<string[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const guard = useUnsavedGuard({ open, onOpenChange });

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
    setDeposit("0");
    setIdImageUrl(null);
    setContractFileUrl(null);
    setUnitPhotos([]);
    setPendingPhoto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit?.id]);

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
    const rentNum = Number(rent) || 0;
    const dueNum = Math.min(31, Math.max(1, Number(dueDay) || 1));
    const depositNum = Number(deposit) || 0;
    const { error: tErr } = await supabase.from("tenancies").insert({
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
      deposit_status: depositNum > 0 ? "held" : "none",
      status: "active",
    });
    if (tErr) { setSaving(false); return toast.error(tErr.message); }

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
    toast.success(t2("tenancy_started_ok"));
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
              <Label className="text-xs text-sage-500">ID</Label>
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
              <Label className="text-xs text-sage-500">{t2("contract_end")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_amount")}</Label>
              <Input type="number" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{t2("rent_type")}</Label>
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
              <Label className="text-xs text-sage-500">{t2("due_day")}</Label>
              <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-sage-500">{lang === "ar" ? "تأمين" : "Deposit"}</Label>
              <Input type="number" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="rounded-xl border-sage-200 h-11" />
            </div>
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
              accept="image/*"
              maxSizeMB={5}
              label={lang === "ar" ? "صورة الهوية" : "ID image"}
              isPrivate
            />
            {idImageUrl && (
              <Button
                type="button"
                variant="outline"
                disabled={extracting}
                onClick={extractFromId}
                className="w-full h-10 rounded-xl border-sage-300 text-sage-700"
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Sparkles className="h-4 w-4 me-2" />}
                {extracting
                  ? (lang === "ar" ? "جاري الاستخراج..." : "Extracting...")
                  : (lang === "ar" ? "استخراج البيانات تلقائياً" : "Auto-extract data")}
              </Button>
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
