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
 * Drop-in usage:
 *   const guard = useUnsavedGuard({ open, onOpenChange });
 *   <Dialog open={open} onOpenChange={guard.handleOpenChange}>
 *     <DialogContent>
 *       <div {...guard.formProps}>...form fields...</div>
 *       <Button onClick={async () => { await save(); guard.markSaved(); onOpenChange(false); }} />
 *     </DialogContent>
 *   </Dialog>
 *   {guard.ConfirmDiscardUI}
 *
 * Dirty is auto-detected from input/change/click-on-button events within
 * `formProps`. Call `markSaved()` right before closing on a successful save.
 */
export function useUnsavedGuard(opts: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { open, onOpenChange } = opts;
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dirtyRef = useRef(false);
  const justSavedRef = useRef(false);

  // Reset dirty state every time the dialog opens fresh.
  useEffect(() => {
    if (open) {
      dirtyRef.current = false;
      justSavedRef.current = false;
    }
  }, [open]);

  // Warn on browser tab close / refresh while dirty.
  useEffect(() => {
    if (!open) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const markSaved = useCallback(() => {
    dirtyRef.current = false;
    justSavedRef.current = true;
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && dirtyRef.current && !justSavedRef.current) {
        setConfirmOpen(true);
        return;
      }
      onOpenChange(next);
    },
    [onOpenChange]
  );

  // Auto-detect dirty: any typed input or pill/toggle click inside the form.
  const formProps = {
    onInput: markDirty,
    onChange: markDirty,
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Buttons used as toggles/pills inside the form mark dirty too.
      if (target.closest("button[type='button']")) markDirty();
    },
  };

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
              dirtyRef.current = false;
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

  return { handleOpenChange, formProps, markSaved, markDirty, ConfirmDiscardUI };
}
