import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

/**
 * Guards a dialog against accidental loss of unsaved changes.
 *
 * Usage:
 *   const { handleOpenChange, ConfirmDiscardUI, markSaved } = useUnsavedGuard({
 *     open, onOpenChange, dirty,
 *   });
 *   <Dialog open={open} onOpenChange={handleOpenChange}>...
 *   {ConfirmDiscardUI}
 *
 * Call markSaved() right after a successful save so closing won't re-prompt.
 */
export function useUnsavedGuard(opts: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  dirty: boolean;
}) {
  const { open, onOpenChange, dirty } = opts;
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const justSavedRef = useRef(false);

  // Warn on browser tab close / refresh while dirty.
  useEffect(() => {
    if (!open || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, dirty]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && dirty && !justSavedRef.current) {
        setConfirmOpen(true);
        return;
      }
      justSavedRef.current = false;
      onOpenChange(next);
    },
    [dirty, onOpenChange]
  );

  const markSaved = useCallback(() => {
    justSavedRef.current = true;
  }, []);

  const ConfirmDiscardUI = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent className="rounded-3xl border-sage-200 max-w-[380px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sage-700">
            {ar ? "لديك تغييرات غير محفوظة" : "Unsaved changes"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {ar
              ? "هل تريد تجاهل التغييرات قبل الإغلاق؟"
              : "Do you want to discard your changes before closing?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-sage-200">
            {ar ? "متابعة التعديل" : "Keep editing"}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={() => {
              setConfirmOpen(false);
              justSavedRef.current = true;
              onOpenChange(false);
            }}
          >
            {ar ? "تجاهل وإغلاق" : "Discard"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { handleOpenChange, ConfirmDiscardUI, markSaved };
}
