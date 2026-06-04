import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Printer, Share2, X } from "lucide-react";
import { inlinePdfFonts } from "@/lib/pdfDocs";

interface StoredPrintPayload {
  html: string;
  filename: string;
  title?: string;
  lang?: "ar" | "en";
}

const STORAGE_PREFIX = "amlaki:print:";

/**
 * Full-page print/share view used as the root-cause fix for iOS Safari and
 * WKWebView (Capacitor) where in-app PDF download, navigator.share(files)
 * and hidden-iframe print all fail. The receipt/contract/statement HTML is
 * stored in sessionStorage by openPrintView() and rendered here. The user
 * then uses Safari's native Share / Print to save as PDF (Files), AirPrint,
 * AirDrop, WhatsApp, Mail — exactly the behavior banks and Stripe use on iOS.
 */
export default function PrintView() {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<StoredPrintPayload | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("missing");
      return;
    }
    const raw = sessionStorage.getItem(STORAGE_PREFIX + token);
    if (!raw) {
      setError("expired");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredPrintPayload;
      setPayload(parsed);
      if (parsed.title) document.title = parsed.title;
      else if (parsed.filename) document.title = parsed.filename;
      // Inline fonts as data URLs so Safari renders Arabic/Latin correctly
      // even when the new tab loses access to the SPA's loaded font faces.
      inlinePdfFonts(parsed.html)
        .then(setHtml)
        .catch(() => setHtml(parsed.html));
    } catch {
      setError("invalid");
    }
  }, [token]);

  const ar = (payload?.lang ?? "ar") === "ar";
  const labelShare = ar ? "حفظ أو مشاركة" : "Save or share";
  const labelPrint = ar ? "طباعة" : "Print";
  const labelClose = ar ? "إغلاق" : "Close";
  const labelLoading = ar ? "جاري تحضير الملف…" : "Preparing document…";
  const labelExpired = ar
    ? "انتهت صلاحية المعاينة. أعد فتح الملف من التطبيق."
    : "This preview expired. Reopen the document from the app.";

  const doPrint = () => {
    // Safari iOS treats window.print() as the Share/Print entry — it opens
    // the system print sheet with Save to Files (PDF) and AirPrint options.
    try { window.print(); } catch { /* noop */ }
  };

  const doClose = () => {
    try { window.close(); } catch { /* noop */ }
  };

  if (error) {
    return (
      <div
        dir={ar ? "rtl" : "ltr"}
        style={{
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: ar
            ? '"Noto Kufi Arabic", Tahoma, sans-serif'
            : '"Outfit", system-ui, sans-serif',
          color: "#223127",
          background: "#faf6ee",
        }}
      >
        <p style={{ maxWidth: 420, textAlign: "center" }}>{labelExpired}</p>
      </div>
    );
  }

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100svh",
        background: "#eef2eb",
        fontFamily: ar
          ? '"Noto Kufi Arabic", Tahoma, sans-serif'
          : '"Outfit", system-ui, sans-serif',
      }}
    >
      <style>{`
        @media print {
          .print-toolbar { display: none !important; }
          body { background: white !important; }
        }
        .print-toolbar-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 12px;
          border: 0;
          font: inherit;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          min-height: 44px;
        }
      `}</style>

      <div
        className="print-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(250, 246, 238, 0.92)",
          backdropFilter: "saturate(180%) blur(12px)",
          WebkitBackdropFilter: "saturate(180%) blur(12px)",
          borderBottom: "1px solid rgba(95,126,101,.18)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingTop: "calc(10px + env(safe-area-inset-top))",
        }}
      >
        <button
          className="print-toolbar-btn"
          onClick={doPrint}
          style={{ background: "#5f7e65", color: "white" }}
          aria-label={labelShare}
        >
          <Share2 size={16} />
          <span>{labelShare}</span>
        </button>
        <button
          className="print-toolbar-btn"
          onClick={doPrint}
          style={{
            background: "white",
            color: "#3d5443",
            border: "1px solid rgba(95,126,101,.25)",
          }}
          aria-label={labelPrint}
        >
          <Printer size={16} />
          <span>{labelPrint}</span>
        </button>
        <button
          className="print-toolbar-btn"
          onClick={doClose}
          style={{
            background: "transparent",
            color: "#6a786b",
            marginInlineStart: "auto",
          }}
          aria-label={labelClose}
        >
          <X size={16} />
          <span>{labelClose}</span>
        </button>
      </div>

      {html ? (
        <iframe
          title={payload?.title || payload?.filename || "document"}
          srcDoc={html}
          style={{
            display: "block",
            width: "100%",
            height: "calc(100svh - 64px)",
            border: 0,
            background: "white",
          }}
        />
      ) : (
        <div
          style={{
            minHeight: "calc(100svh - 64px)",
            display: "grid",
            placeItems: "center",
            color: "#6a786b",
            gap: 10,
          }}
        >
          <Loader2 className="animate-spin" size={22} />
          <span style={{ fontSize: 14 }}>{labelLoading}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Helper exported for use by pdfDocs.openPrintView — keeps the storage key
 * format in a single place.
 */
export const PRINT_VIEW_STORAGE_PREFIX = STORAGE_PREFIX;
