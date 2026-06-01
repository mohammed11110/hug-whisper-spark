# Receipt: choose Arabic or English on print/download

## Goal
In صفحة المدفوعات (Payments), each receipt currently has a Print button and a Download PDF button — both use the current app language. Add an explicit AR / EN choice so the user can print or download a receipt in either language regardless of the UI language.

## Scope
- File only: `src/pages/Payments.tsx`
- No DB changes, no changes to receipt HTML/PDF generation (already supports both languages via `buildReceiptHTML(r, lng)`).
- No changes to UnitDetail or other pages.

## UX
Replace the two single icon buttons (Printer, Download) with two **DropdownMenu** triggers:

1. **Print** (Printer icon) → opens menu with:
   - `طباعة بالعربية` / Print (Arabic)
   - `Print in English` / طباعة بالإنجليزية
2. **Download PDF** (Download icon) → opens menu with:
   - `تحميل PDF بالعربية` / Download PDF (Arabic)
   - `Download PDF in English` / تحميل PDF بالإنجليزية

Labels follow `lang` for the UI text; the action passes the chosen `RLang` (`"ar"` or `"en"`) to existing `printReceipt(r, lng)` / `downloadReceiptPDF(r, lng)` (signatures already accept it).

Buttons keep current size (h-7 w-7), styling, and icons. The dropdown uses the existing `@/components/ui/dropdown-menu` primitives already used in the project.

## Technical notes
- Import `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `@/components/ui/dropdown-menu`.
- `printReceipt` and `downloadReceiptPDF` already take an optional `lng: RLang` argument — no changes needed to those functions.
- Remove default-language behavior at call sites; always pass the explicit chosen language from the menu item.
- RTL is already handled by the dropdown primitives.

## Out of scope
- Adding receipt print/download inside UnitDetail.
- Changing receipt template content or styling.
- A global default-language setting for receipts.
