import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * زر معلومات (i) صغير يظهر بجانب اسم الحقل ويفتح فقاعة شرح عند الضغط.
 * يعمل باللمس على الموبايل والـclick على الديسكتوب.
 */
export function FieldHelp({ content, side = "top" }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="معلومات"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-sage-500 hover:text-sage-700 hover:bg-sage-100/60 transition-colors align-middle shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        sideOffset={6}
        className="max-w-[260px] w-auto text-xs leading-relaxed text-sage-700 bg-white border border-sage-200 shadow-[0_8px_24px_-8px_rgba(95,126,101,0.25)] rounded-xl px-3 py-2"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
