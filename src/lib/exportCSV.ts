import { saveBlobUniversal } from "@/lib/nativeFiles";

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  // saveBlobUniversal handles native (Share sheet) vs web (<a download>).
  void saveBlobUniversal(blob, name, { title: name });
}
