import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import { Button } from "@/components/ui/button";

type Bucket = "contracts" | "tenant-ids" | "unit-photos" | "branding";

interface FileUploadProps {
  bucket: Bucket;
  /** Path prefix inside bucket. For private buckets MUST start with the building_id (or user id for branding). e.g. `${buildingId}/${unitId}` */
  pathPrefix: string;
  /** Current file URL/path stored in DB (used to display preview & delete). For private buckets pass the storage path; for public, pass public URL. */
  value?: string | null;
  onChange: (value: string | null) => void;
  /** mime accept list, e.g. "application/pdf" or "image/*" */
  accept?: string;
  /** Max size in MB (default 10) */
  maxSizeMB?: number;
  label?: string;
  /** If true, store object path (private bucket); if false, store public URL (public bucket). */
  isPrivate?: boolean;
  /** If true, allow selecting and uploading multiple files at once. Uses onMultipleUploaded for results. */
  multiple?: boolean;
  /** Called once after a multi-upload batch finishes with the uploaded paths/URLs. */
  onMultipleUploaded?: (values: string[]) => void;
}

export function FileUpload({
  bucket,
  pathPrefix,
  value,
  onChange,
  accept = "*/*",
  maxSizeMB = 10,
  label = "رفع ملف",
  isPrivate = true,
  multiple = false,
  onMultipleUploaded,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const isImage = (n: string) => /\.(png|jpe?g|webp|gif|heic)$/i.test(n);

  // For private buckets, generate signed URL for preview
  const ensurePreview = async () => {
    if (!value || !isPrivate) return;
    if (signedUrl) return;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
    if (data?.signedUrl) setSignedUrl(data.signedUrl);
  };

  const [optimizing, setOptimizing] = useState(false);

  const handleFile = async (rawFile: File) => {
    setOptimizing(true);
    const file = await compressImage(rawFile);
    setOptimizing(false);
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`الملف أكبر من ${maxSizeMB} ميغابايت`);
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${pathPrefix.replace(/\/+$/, "")}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      if (isPrivate) {
        onChange(path);
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        onChange(data.publicUrl);
      }
      toast.success("تم الرفع");
    } catch (e: any) {
      toast.error(e.message || "فشل الرفع");
    } finally {
      setBusy(false);
    }
  };

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const uploadOne = async (rawFile: File): Promise<string> => {
    const file = await compressImage(rawFile);
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`${file.name}: > ${maxSizeMB}MB`);
    }
    const ext = file.name.split(".").pop() || "bin";
    const path = `${pathPrefix.replace(/\/+$/, "")}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    if (isPrivate) return path;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length > 20) {
      toast.warning(`الحد الأقصى 20 صورة في الدفعة الواحدة (تم اختيار ${files.length})`);
      files = files.slice(0, 20);
    }
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    const results: string[] = [];
    let failed = 0;
    for (const f of files) {
      try {
        const v = await uploadOne(f);
        results.push(v);
      } catch (e: any) {
        failed++;
        console.warn("upload failed", e);
      } finally {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    setBusy(false);
    setProgress(null);
    if (results.length) {
      onMultipleUploaded?.(results);
      toast.success(`تم رفع ${results.length} صورة${failed ? ` (فشل ${failed})` : ""}`);
    } else if (failed) {
      toast.error("فشل الرفع");
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    if (isPrivate) {
      await supabase.storage.from(bucket).remove([value]);
    } else {
      // extract path from public URL
      const idx = value.indexOf(`/${bucket}/`);
      if (idx >= 0) {
        const path = value.slice(idx + bucket.length + 2);
        await supabase.storage.from(bucket).remove([path]);
      }
    }
    onChange(null);
    setSignedUrl(null);
  };

  const previewUrl = isPrivate ? signedUrl : value;

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-bold text-sage-600">{label}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          if (multiple) {
            if (list.length) handleFiles(list);
          } else {
            const f = list[0];
            if (f) handleFile(f);
          }
          e.target.value = "";
        }}
      />
      {!multiple && value ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-sage-100/50 border border-sage-200/40">
          {value && isImage(value) ? <ImageIcon className="h-4 w-4 text-sage-500" /> : <FileText className="h-4 w-4 text-sage-500" />}
          <button
            type="button"
            onClick={async () => { await ensurePreview(); if (previewUrl) window.open(previewUrl, "_blank"); }}
            className="flex-1 text-start text-xs text-sage-600 truncate hover:underline"
          >
            عرض الملف
          </button>
          <button type="button" onClick={handleRemove} className="text-burgundy hover:opacity-70" aria-label="حذف">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy || optimizing}
          onClick={() => inputRef.current?.click()}
          className="w-full h-11 rounded-xl border-dashed border-sage-300 text-sage-600 font-medium"
        >
          {busy || optimizing ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Upload className="h-4 w-4 me-2" />}
          {optimizing
            ? "يجري التحسين…"
            : busy
            ? progress
              ? `جاري الرفع ${progress.done}/${progress.total}...`
              : "جاري الرفع..."
            : label}
        </Button>
      )}
    </div>
  );
}
