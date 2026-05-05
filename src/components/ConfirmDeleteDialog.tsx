import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useT2 } from "@/lib/i18n2";

export function ConfirmDeleteDialog({
  open, onOpenChange, onConfirm, title, description,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}) {
  const t2 = useT2();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[360px] rounded-3xl border-sage-200 bg-background animate-scale-in">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sage-600 text-lg font-black">{title || t2("delete_confirm")}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-muted-foreground">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="flex-1 rounded-xl border-sage-200 mt-0">{t2("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="flex-1 rounded-xl bg-burgundy hover:bg-burgundy/90 text-primary-foreground">{t2("delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
