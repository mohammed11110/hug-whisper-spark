import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { PenTool, Upload, Trash2, RefreshCw, Loader2, Check } from "lucide-react";
import {
  loadSignature,
  saveSignature,
  deleteSignature,
  clearSignatureCache,
  primeSignatureCache,
} from "@/lib/signature";
import { supabase } from "@/integrations/supabase/client";

const tr = (lang: string, ar: string, en: string) => (lang === "ar" ? ar : en);

type Point = { x: number; y: number; t: number; p: number };

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
  const pad = 12;
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(blob);
  });
}

/** Convert an image File into a transparent PNG: PNG kept as-is; others rasterized on white. */
async function fileToSignaturePngBlob(file: File): Promise<Blob> {
  const isHeic =
    /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    throw new Error("HEIC_UNSUPPORTED");
  }
  if (file.type === "image/png") return file;

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("IMAGE_DECODE_FAILED"));
      img.src = url;
    });
    const maxW = 1400;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    // White background so JPGs don't render black on some platforms
    cx.fillStyle = "#ffffff";
    cx.fillRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    return await canvasToPngBlob(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SignatureManager() {
  const { lang } = useI18n();

  const [loading, setLoading] = useState(true);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async (opts: { hard?: boolean; silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    if (opts.hard) clearSignatureCache();
    const res = await loadSignature();
    setDataUrl(res.url);
    setLoading(false);
    if (res.hasRemotePointer && !res.url && res.error) {
      toast.error(tr(
        lang,
        "تعذّر تحميل التوقيع — تحقق من الاتصال ثم أعد المحاولة",
        "Could not load your signature — check your connection and retry",
      ));
    } else if (res.fromCache && res.error) {
      // We showed the cached copy; server unreachable. No toast — non-blocking.
      console.warn("[signature] showing cached copy:", res.error);
    }
  };

  useEffect(() => {
    void refresh();
    // Re-fetch when auth session is restored (e.g. iOS cold start where the
    // component mounts before the session is rehydrated).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        void refresh({ silent: true });
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Save + show immediately from the in-memory blob (no round-trip). */
  const persistAndShow = async (blob: Blob) => {
    await saveSignature(blob);
    const url = await blobToDataUrl(blob);
    await primeSignatureCache(url);
    setDataUrl(url);
  };

  const handleUpload = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error(tr(lang, "حجم الصورة كبير (الحد 4MB)", "Image too large (max 4MB)"));
      return;
    }
    setSaving(true);
    try {
      const blob = await fileToSignaturePngBlob(file);
      await persistAndShow(blob);
      toast.success(tr(lang, "تم حفظ التوقيع", "Signature saved"));
    } catch (e: any) {
      const code = e?.message || "";
      if (code === "HEIC_UNSUPPORTED") {
        toast.error(tr(
          lang,
          "صيغة HEIC غير مدعومة — حوّل الصورة إلى JPG أو PNG ثم أعد المحاولة",
          "HEIC is not supported — convert to JPG or PNG and try again",
        ));
      } else if (code === "IMAGE_DECODE_FAILED") {
        toast.error(tr(lang, "تعذّر قراءة الصورة", "Could not read the image"));
      } else {
        toast.error(code || tr(lang, "تعذّر الحفظ", "Save failed"));
      }
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
            key={dataUrl.slice(-32)}
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
        accept="image/*"
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
            await persistAndShow(blob);
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const currentRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  const dprRef = useRef(1);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);

  // Setup canvas to fill its wrapper + handle resize/orientation
  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;

    const setupSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      dprRef.current = dpr;
      const cssW = wrap.clientWidth;
      const cssH = wrap.clientHeight;
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
      c.style.width = `${cssW}px`;
      c.style.height = `${cssH}px`;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1A1C24";
      redrawAll();
    };

    strokesRef.current = [];
    currentRef.current = [];
    setHasInk(false);
    setupSize();

    const ro = new ResizeObserver(setupSize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [open]);

  const redrawAll = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = dprRef.current;
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
    for (const s of strokesRef.current) drawSmoothStroke(ctx, s);
    if (currentRef.current.length) drawSmoothStroke(ctx, currentRef.current);
  };

  /** Catmull-Rom-ish smoothing with variable width per segment (speed + pressure). */
  const drawSmoothStroke = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
    if (pts.length < 2) {
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = "#1A1C24";
        ctx.fill();
      }
      return;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dt = Math.max(1, p1.t - p0.t);
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const speed = dist / dt; // px/ms
      const pressure = (p0.p + p1.p) / 2;
      const pFactor = pressure > 0 ? 0.55 + pressure * 0.9 : 1;
      const width = clamp(1.9 - speed * 0.85, 0.7, 2.1) * pFactor;
      ctx.lineWidth = width;

      const pPrev = pts[i - 1] || p0;
      const pNext = pts[i + 2] || p1;
      const cp1x = p0.x + (p1.x - pPrev.x) / 6;
      const cp1y = p0.y + (p1.y - pPrev.y) / 6;
      const cp2x = p1.x - (pNext.x - p0.x) / 6;
      const cp2y = p1.y - (pNext.y - p0.y) / 6;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
      ctx.stroke();
    }
  };

  const pointFrom = (e: React.PointerEvent | PointerEvent): Point => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const native: any = (e as any).nativeEvent ?? e;
    const pressure =
      typeof native.pressure === "number" && native.pressure > 0 && native.pressure !== 0.5
        ? native.pressure
        : 0;
    return {
      x: (e as any).clientX - r.left,
      y: (e as any).clientY - r.top,
      t: performance.now(),
      p: pressure,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    currentRef.current = [pointFrom(e)];
    redrawAll();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const native: any = e.nativeEvent;
    const coalesced: PointerEvent[] =
      typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    if (coalesced.length > 0) {
      for (const ce of coalesced) currentRef.current.push(pointFrom(ce as any));
    } else {
      currentRef.current.push(pointFrom(e));
    }
    redrawAll();
  };

  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current.length > 1) {
      strokesRef.current.push(currentRef.current);
      setHasInk(true);
    }
    currentRef.current = [];
    redrawAll();
  };

  const undo = () => {
    strokesRef.current.pop();
    setHasInk(strokesRef.current.length > 0);
    redrawAll();
  };
  const clear = () => {
    strokesRef.current = [];
    currentRef.current = [];
    setHasInk(false);
    redrawAll();
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
      <DialogContent
        className="max-w-none w-screen h-[100dvh] sm:rounded-none p-0 gap-0 border-0 flex flex-col"
      >
        <DialogHeader className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
          <DialogTitle className="text-base text-start">
            {tr(lang, "ارسم توقيعك", "Draw your signature")}
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground text-start mt-0.5">
            {tr(lang, "وقّع بإصبعك أو بقلم اللمس — استخدم الوضع الأفقي لمساحة أكبر", "Sign with your finger or stylus — rotate for more room")}
          </p>
        </DialogHeader>

        <div
          ref={wrapRef}
          className="flex-1 bg-[#FBFAF7] touch-none relative overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full select-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onPointerCancel={onUp}
          />
          {/* baseline guide */}
          <div className="pointer-events-none absolute inset-x-8 bottom-[28%] border-t border-dashed border-sage-300/70" />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-card/80 backdrop-blur">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!hasInk || saving}>
              {tr(lang, "مسح", "Clear")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={undo} disabled={!hasInk || saving}>
              {tr(lang, "تراجع", "Undo")}
            </Button>
          </div>
          <Button type="button" size="sm" onClick={save} disabled={!hasInk || saving} className="min-w-[96px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(lang, "حفظ التوقيع", "Save signature")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
