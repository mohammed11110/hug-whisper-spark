/**
 * Lazy facade for `@/lib/pdfDocs`.
 *
 * `pdfDocs.ts` embeds the full Noto Kufi Arabic + Outfit base64 font
 * payloads and pulls in `jspdf` and `html2canvas`. Importing it
 * statically at the top of any page balloons that page's chunk by
 * several hundred KB and adds noticeable parse/eval time on
 * navigation — especially on iPad/Safari.
 *
 * Every export here is async and proxies through `import("@/lib/pdfDocs")`
 * so the heavy module is only fetched and parsed when the user
 * actually triggers print / download / share.
 *
 * Types are re-exported as plain `type` imports — they are erased at
 * compile time and have zero runtime cost.
 */
import type {
  ReceiptData,
  ReportData,
  StatementRow,
  TenantStatementData,
  UnitStatementData,
  UnitStatementLeaseBlock,
  UnitStatementRow,
  BrandInfo,
  Lease,
} from "@/lib/pdfDocs";

export type {
  ReceiptData,
  ReportData,
  StatementRow,
  TenantStatementData,
  UnitStatementData,
  UnitStatementLeaseBlock,
  UnitStatementRow,
  BrandInfo,
  Lease,
};


type PdfModule = typeof import("@/lib/pdfDocs");

let _modPromise: Promise<PdfModule> | null = null;
function loadMod(): Promise<PdfModule> {
  if (!_modPromise) _modPromise = import("@/lib/pdfDocs");
  return _modPromise;
}

/** Optional warm-up — call from idle / hover to prefetch the chunk. */
export function prefetchPdfDocs(): void {
  void loadMod();
}

// ---------- Receipt ----------
export async function buildReceiptHTML(data: ReceiptData): Promise<string> {
  return (await loadMod()).buildReceiptHTML(data);
}
export async function downloadReceiptPDFDirect(data: ReceiptData, filename: string): Promise<void> {
  return (await loadMod()).downloadReceiptPDFDirect(data, filename);
}
export async function printReceiptPDFDirect(data: ReceiptData, filename: string): Promise<void> {
  return (await loadMod()).printReceiptPDFDirect(data, filename);
}

// ---------- Lease ----------
export async function buildLeaseHTML(data: Lease): Promise<string> {
  return (await loadMod()).buildLeaseHTML(data);
}
export async function buildOmaniLeaseHTML(data: Lease): Promise<string> {
  return (await loadMod()).buildOmaniLeaseHTML(data);
}
export async function downloadLeasePDF(data: Lease, filename: string): Promise<void> {
  return (await loadMod()).downloadLeasePDF(data, filename);
}

// ---------- Tenant Statement ----------
export async function buildTenantStatementHTML(data: TenantStatementData): Promise<string> {
  return (await loadMod()).buildTenantStatementHTML(data);
}
export async function downloadTenantStatementPDFDirect(data: TenantStatementData, filename: string): Promise<void> {
  return (await loadMod()).downloadTenantStatementPDFDirect(data, filename);
}
export async function printTenantStatementPDFDirect(data: TenantStatementData, filename: string): Promise<void> {
  return (await loadMod()).printTenantStatementPDFDirect(data, filename);
}

// ---------- Unit Statement (grouped by lease) ----------
export async function downloadUnitStatementPDFDirect(data: UnitStatementData, filename: string): Promise<void> {
  return (await loadMod()).downloadUnitStatementPDFDirect(data, filename);
}
export async function printUnitStatementPDFDirect(data: UnitStatementData, filename: string): Promise<void> {
  return (await loadMod()).printUnitStatementPDFDirect(data, filename);
}


// ---------- Report ----------
export async function buildReportHTML(data: ReportData): Promise<string> {
  return (await loadMod()).buildReportHTML(data);
}
export async function downloadReportPDFDirect(...args: Parameters<PdfModule["downloadReportPDFDirect"]>): Promise<void> {
  return (await loadMod()).downloadReportPDFDirect(...args);
}

// ---------- Generic HTML helpers ----------
export async function downloadHTMLAsPDF(...args: Parameters<PdfModule["downloadHTMLAsPDF"]>): Promise<void> {
  return (await loadMod()).downloadHTMLAsPDF(...args);
}
export async function printHTML(html: string): Promise<void> {
  return (await loadMod()).printHTML(html);
}
export async function inlinePdfFonts(html: string): Promise<string> {
  return (await loadMod()).inlinePdfFonts(html);
}
