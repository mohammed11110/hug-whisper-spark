import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useT2 } from "@/lib/i18n2";
import { ShieldAlert } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expectedPin: string;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function PinDialog({ open, onOpenChange, expectedPin, onSuccess, title, description }: Props) {
  const t2 = useT2();
  const { lang } = useI18n();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => { if (open) { setPin(""); setErr(false); } }, [open]);

  const submit = () => {
    if (pin === expectedPin) {
      onOpenChange(false);
      onSuccess();
    } else {
      setErr(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-burgundy">
            <ShieldAlert className="h-5 w-5" />
            {title || (lang === "ar" ? "أدخل الرقم السري" : "Enter PIN")}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={12}
          value={pin}
          onChange={(e) => { setPin(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className={`rounded-xl text-center font-mono text-lg tracking-[0.5em] h-12 ${err ? "border-burgundy" : "border-sage-200"}`}
          placeholder="••••"
        />
        {err && (
          <p className="text-xs text-burgundy text-center -mt-1">
            {lang === "ar" ? "رقم سري غير صحيح" : "Incorrect PIN"}
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl flex-1">{t2("cancel")}</Button>
          <Button onClick={submit} className="rounded-xl flex-1 bg-burgundy hover:bg-burgundy/90 text-primary-foreground">
            {lang === "ar" ? "تأكيد" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
