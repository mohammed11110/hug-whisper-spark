import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { PenTool, Upload, Trash2, RefreshCw, Loader2, Check } from "lucide-react";
import {
  getSignatureDataUrl,
  saveSignature,
  deleteSignature,
  clearSignatureCache,
} from "@/lib/signature";

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

type Point = { x: number; y: number };

/** Trim transparent margins from a canvas; returns a fresh canvas. */
function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext("2d");
  if (!ctx) return src;
  const { width, height } = src;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src; // empty
  const pad = 8;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const w = Math.min(width, maxX - x0 + pad * 2);
  const h = Math.min(height, maxY - y0 + pad * 2);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(src, x0, y0, w, h, 0, 0, w, h);
  return out;
}

function canvasToPngBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))), "image/png");
  });
}

/** Convert an image File into a transparent PNG: keeps PNG as-is, JPG kept on white. */
async function fileToSignaturePngBlob(file: File): Promise<Blob> {
  if (file.type === "image/png") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = url;
    });
    const maxW = 1200;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.drawImage(img, 0, 0, w, h);
    return await canvasToPngBlob(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SignatureManager() {
  const { lang } = useI18n();
  const isAr = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    clearSignatureCache();
    const url = await getSignatureDataUrl();
    setDataUrl(url);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const handleUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error(tr(lang, "حجم الصورة كبير (الحد 2MB)", "Image too large (max 2MB)"));
      return;
    }
    setSaving(true);
    try {
      const blob = await fileToSignaturePngBlob(file);
      await saveSignature(blob);
      await refresh();
      toast.success(tr(lang, "تم حفظ التوقيع", "Signature saved"));
    } catch (e: any) {
      toast.error(e?.message || tr(lang, "تعذّر الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(tr(lang, "حذف التوقيع؟", "Delete signature?"))) return;
    setSaving(true);
    try {
      await deleteSignature();
      setDataUrl(null);
      toast.success(tr(lang, "تم الحذف", "Deleted"));
    } catch (e: any) {
      toast.error(e?.message || tr(lang, "تعذّر الحذف", "Delete failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-sage text-primary-foreground grid place-items-center shadow-soft">
          <PenTool className="h-5 w-5" />
        </div>
        <div className="flex-1 text-start">
          <p className="font-bold text-sm text-sage-600">
            {tr(lang, "التوقيع الإلكتروني", "Electronic signature")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {tr(lang, "يُحقن تلقائياً في كل إيصال تُصدره", "Auto-injected into every receipt you issue")}
          </p>
        </div>
        {dataUrl && <Check className="h-4 w-4 text-emerald-600" />}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-sage-200/60 bg-[#FBFAF7] min-h-[120px] grid place-items-center p-3 mb-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={tr(lang, "توقيعك", "Your signature")}
            className="max-h-[110px] object-contain"
          />
        ) : (
          <p className="text-xs text-muted-foreground text-center px-4">
            {tr(
              lang,
              "لم تُنشئ توقيعاً بعد — أنشئه مرة واحدة وسيُحقن في كل إيصال",
              "No signature yet — set it once and it will appear on every receipt",
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => setDrawOpen(true)}
          disabled={saving}
        >
          <PenTool className="h-4 w-4 me-1.5" />
          {tr(lang, dataUrl ? "إعادة الرسم" : "ارسم التوقيع", dataUrl ? "Redraw" : "Draw")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => fileRef.current?.click()}
          disabled={saving}
        >
          <Upload className="h-4 w-4 me-1.5" />
          {tr(lang, "رفع صورة", "Upload image")}
        </Button>
        {dataUrl && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl col-span-1"
              onClick={refresh}
              disabled={saving}
            >
              <RefreshCw className="h-4 w-4 me-1.5" />
              {tr(lang, "تحديث", "Refresh")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-red-300 text-red-700 hover:bg-red-50 col-span-1"
              onClick={handleDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 me-1.5" />
              {tr(lang, "حذف", "Delete")}
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) await handleUpload(f);
        }}
      />

      <SignaturePadDialog
        open={drawOpen}
        onOpenChange={setDrawOpen}
        onSaved={async (blob) => {
          setSaving(true);
          try {
            await saveSignature(blob);
            await refresh();
            toast.success(tr(lang, "تم حفظ التوقيع", "Signature saved"));
            setDrawOpen(false);
          } catch (e: any) {
            toast.error(e?.message || tr(lang, "تعذّر الحفظ", "Save failed"));
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

/* ----------------------- Draw pad ----------------------- */

function SignaturePadDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (blob: Blob) => Promise<void>;
}) {
  const { lang } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const strokesRef = useRef<Point[][]>([]);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);

  // Setup canvas DPR + clear when (re)opened
  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth;
    const cssH = c.clientHeight;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#1A1C24";
    strokesRef.current = [];
    pointsRef.current = [];
    setHasInk(false);
  }, [open]);

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    if (pointsRef.current.length) drawStroke(ctx, pointsRef.current);
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };

  const pos = (e: PointerEvent | React.PointerEvent): Point => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e as any).clientX - r.left, y: (e as any).clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    pointsRef.current = [pos(e)];
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    pointsRef.current.push(pos(e));
    redraw();
  };
  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (pointsRef.current.length > 1) {
      strokesRef.current.push(pointsRef.current);
      setHasInk(true);
    }
    pointsRef.current = [];
    redraw();
  };

  const undo = () => {
    strokesRef.current.pop();
    setHasInk(strokesRef.current.length > 0);
    redraw();
  };
  const clear = () => {
    strokesRef.current = [];
    pointsRef.current = [];
    setHasInk(false);
    redraw();
  };

  const save = async () => {
    if (!hasInk) return;
    const c = canvasRef.current!;
    setSaving(true);
    try {
      const trimmed = trimCanvas(c);
      const blob = await canvasToPngBlob(trimmed);
      await onSaved(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tr(lang, "ارسم توقيعك", "Draw your signature")}</DialogTitle>
        </DialogHeader>
        <div
          className="rounded-xl border border-sage-200 bg-[#FBFAF7] overflow-hidden touch-none"
          style={{ aspectRatio: "3 / 1" }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onPointerCancel={onUp}
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          {tr(lang, "وقّع بإصبعك أو بقلم اللمس", "Sign with your finger or stylus")}
        </p>
        <DialogFooter className="flex !flex-row !justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!hasInk || saving}>
              {tr(lang, "مسح", "Clear")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={undo} disabled={!hasInk || saving}>
              {tr(lang, "تراجع", "Undo")}
            </Button>
          </div>
          <Button type="button" size="sm" onClick={save} disabled={!hasInk || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(lang, "حفظ", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
