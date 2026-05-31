import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText, Table as TableIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type FilePreviewPayload =
  | {
      type: "pdf";
      title: string;
      filename: string;
      html: string;
      onSave: () => void | Promise<void>;
      onPrint?: () => void;
    }
  | {
      type: "csv";
      title: string;
      filename: string;
      rows: Record<string, any>[];
      headerLabels?: Record<string, string>;
      onSave: () => void | Promise<void>;
    };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: FilePreviewPayload | null;
}

function approxKB(rows: Record<string, any>[]) {
  if (!rows.length) return 0;
  const headers = Object.keys(rows[0]);
  let chars = headers.join(",").length + 1;
  for (const r of rows) chars += headers.map((h) => String(r[h] ?? "")).join(",").length + 1;
  return Math.max(1, Math.round(chars / 1024));
}

export function FilePreviewDialog({ open, onOpenChange, payload }: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  if (!payload) return null;

  const labelPreview = ar ? "معاينة الملف" : "File preview";
  const labelSave = ar ? "حفظ الملف" : "Save file";
  const labelPrint = ar ? "طباعة" : "Print";
  const labelCancel = ar ? "إلغاء" : "Cancel";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={ar ? "rtl" : "ltr"}
        className="max-w-4xl w-[95vw] p-0 overflow-hidden rounded-3xl border-sage-200 bg-card"
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-sage-200/60 bg-cream/40">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-sage-100 grid place-items-center text-sage-600">
              {payload.type === "pdf" ? <FileText className="h-4 w-4" /> : <TableIcon className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-sage-700 truncate text-start">
                {labelPreview}
              </DialogTitle>
              <p className="text-xs text-sage-500 truncate text-start mt-0.5">
                {payload.title} · <span className="font-mono text-[11px]">{payload.filename}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-4 pt-3 pb-4 bg-cream/20">
          {payload.type === "pdf" ? (
            <div className="rounded-2xl overflow-hidden border border-sage-200 bg-white" style={{ height: "65vh" }}>
              <iframe
                title={labelPreview}
                srcDoc={withBase(payload.html)}
                className="w-full h-full"
                style={{ border: 0 }}
              />
            </div>
          ) : (
            <CsvPreview rows={payload.rows} headerLabels={payload.headerLabels} ar={ar} />
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-sage-200/60 bg-card flex-row gap-2 sm:gap-2 sm:justify-start">
          <Button
            onClick={() => payload.onSave()}
            className="rounded-xl bg-gradient-sage text-primary-foreground font-semibold h-11 px-5"
          >
            <Download className="h-4 w-4 me-1.5" />
            {labelSave}
          </Button>
          {payload.type === "pdf" && payload.onPrint && (
            <Button
              variant="outline"
              onClick={payload.onPrint}
              className="rounded-xl border-sage-300 text-sage-600 font-semibold h-11 px-4"
            >
              <Printer className="h-4 w-4 me-1.5" />
              {labelPrint}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-sage-500 font-semibold h-11 px-4 ms-auto"
          >
            <X className="h-4 w-4 me-1.5" />
            {labelCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CsvPreview({
  rows,
  headerLabels,
  ar,
}: {
  rows: Record<string, any>[];
  headerLabels?: Record<string, string>;
  ar: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-sage-300 p-10 text-center text-sage-500 text-sm">
        {ar ? "لا توجد بيانات للمعاينة" : "No data to preview"}
      </div>
    );
  }
  const headers = Object.keys(rows[0]);
  const kb = approxKB(rows);
  const labelRows = ar ? "عدد الصفوف" : "Rows";
  const labelSize = ar ? "الحجم التقريبي" : "Approx. size";
  const labelKB = ar ? "كيلوبايت" : "KB";

  return (
    <div>
      <div className="flex items-center gap-3 mb-2.5 px-1 text-xs text-sage-500">
        <span className="rounded-lg bg-sage-100 px-2.5 py-1 font-semibold text-sage-600">
          {labelRows}: {rows.length.toLocaleString(ar ? "ar-OM-u-nu-latn" : "en-US")}
        </span>
        <span className="rounded-lg bg-sage-100 px-2.5 py-1 font-semibold text-sage-600">
          {labelSize}: {kb} {labelKB}
        </span>
      </div>
      <div
        className="rounded-2xl border border-sage-200 bg-white overflow-auto"
        style={{ maxHeight: "60vh" }}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-cream/80 backdrop-blur z-10">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-start font-bold text-sage-600 border-b border-sage-200 whitespace-nowrap"
                >
                  {headerLabels?.[h] || h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-sage-100/60 hover:bg-cream/40">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-sage-700 whitespace-nowrap">
                    {r[h] === null || r[h] === undefined || r[h] === "" ? (
                      <span className="text-sage-300">—</span>
                    ) : (
                      String(r[h])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
