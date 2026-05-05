import { useState } from "react";
import { Globe } from "lucide-react";
import { LANGUAGES, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function LanguageSwitcher({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} size="sm" className="gap-1.5 rounded-full">
          <Globe className="h-4 w-4" />
          <span className="text-sm">{current.flag} {current.name}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-background max-w-[430px] mx-auto">
        <div className="py-2">
          <h3 className="text-lg font-bold mb-4 text-sage-600">Language / اللغة</h3>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  l.code === lang ? "bg-gradient-sage text-primary-foreground shadow-soft" : "hover:bg-muted"
                }`}
              >
                <span className="text-2xl">{l.flag}</span>
                <span className="font-semibold flex-1 text-start">{l.name}</span>
                {l.code === lang && <span className="text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
