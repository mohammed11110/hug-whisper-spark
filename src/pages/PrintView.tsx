import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Printer, Share2, ArrowRight, ArrowLeft } from "lucide-react";
import { downloadHTMLAsPDF, inlinePdfFonts } from "@/lib/pdfDocs";

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
 * AirDrop, WhatsApp, Mail.
 *
 * Implementation notes for iPad/WKWebView:
 *  - Uses a Blob URL (not srcDoc) for the iframe — srcDoc renders blank on
 *    WKWebView frequently.
 *  - Always shows a working "back" button — window.close() does not work
 *    inside Capacitor, and there is no native chrome.
 *  - 3s fallback timeout on font inlining so the spinner never sticks.
 */
export default function PrintView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<StoredPrintPayload | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
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
    let cancelled = false;
    let createdUrl: string | null = null;
    try {
      const parsed = JSON.parse(raw) as StoredPrintPayload;
      setPayload(parsed);
      if (parsed.title) document.title = parsed.title;
      else if (parsed.filename) document.title = parsed.filename;
      const timeout = new Promise<string>((resolve) =>
        setTimeout(() => resolve(parsed.html), 3000)
      );
      Promise.race([inlinePdfFonts(parsed.html), timeout])
        .catch(() => parsed.html)
        .then((finalHtml) => {
          if (cancelled) return;
          const blob = new Blob([finalHtml || parsed.html], {
            type: "text/html;charset=utf-8",
          });
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        });
    } catch {
      setError("invalid");
    }
    return () => {
      cancelled = true;
      if (createdUrl) {
        try { URL.revokeObjectURL(createdUrl); } catch { /* noop */ }
      }
    };
  }, [token]);

  const ar = (payload?.lang ?? "ar") === "ar";
  const labelShare = ar ? "حفظ أو مشاركة" : "Save or share";
  const labelPrint = ar ? "طباعة" : "Print";
  const labelBack = ar ? "رجوع" : "Back";
  const labelLoading = ar ? "جاري تحضير الملف…" : "Preparing document…";
  const labelExpired = ar
    ? "انتهت صلاحية المعاينة. أعد فتح الملف من التطبيق."
    : "This preview expired. Reopen the document from the app.";

  const doShare = async () => {
    if (!payload) return;
    try {
      await downloadHTMLAsPDF(payload.html, payload.filename || "document.pdf");
    } catch (e) {
      console.error("[print-view:share]", e);
    }
  };

  const doPrint = () => {
    try { window.print(); } catch (e) { console.error("[print-view:print]", e); }
  };

  const doBack = () => {
    // Inside Capacitor/WKWebView there is no native back chrome and
    // window.close() does not work. Use history.back() if there is a
    // previous entry, otherwise route to a safe in-app destination.
    try {
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch { /* noop */ }
    navigate("/", { replace: true });
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
          gap: 16,
        }}
      >
        <p style={{ maxWidth: 420, textAlign: "center" }}>{labelExpired}</p>
        <button
          onClick={doBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 12,
            border: 0,
            background: "#5f7e65",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          {ar ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          <span>{labelBack}</span>
        </button>
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
          onClick={doBack}
          style={{
            background: "white",
            color: "#3d5443",
            border: "1px solid rgba(95,126,101,.25)",
          }}
          aria-label={labelBack}
        >
          {ar ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          <span>{labelBack}</span>
        </button>
        <button
          className="print-toolbar-btn"
          onClick={() => { void doShare(); }}
          style={{ background: "#5f7e65", color: "white", marginInlineStart: "auto" }}
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
      </div>

      {blobUrl ? (
        <iframe
          title={payload?.title || payload?.filename || "document"}
          src={blobUrl}
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
