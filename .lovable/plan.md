# Restore bilingual View / Share for receipts

## Issue
After the Payments redesign, the receipt card only exposes a single **View** and single **Share** button — both using the current `receiptLang`. The previous bilingual options (view & share in Arabic *and* English) were removed. Download and Print kept their AR/EN variants, but View/Share didn't.

## Fix — `src/pages/Payments.tsx`
Add AR/EN variants for View and Share inside the existing `DropdownMenu` (around lines 671–702), mirroring the Download/Print pattern:

```
View (Arabic)   → printReceipt(r, "ar")
View (English)  → printReceipt(r, "en")
─────
Share (Arabic)  → shareReceipt(r, "ar")
Share (English) → shareReceipt(r, "en")
─────
(existing Edit, Download AR/EN, Print AR/EN, Delete)
```

Order in the menu, top to bottom:
1. Edit
2. ── separator ──
3. View (Arabic) · View (English)
4. Share (Arabic) · Share (English)
5. ── separator ──
6. Download (Arabic) · Download (English)
7. Print (Arabic) · Print (English)
8. ── separator ──
9. Delete

The primary **View** and **Share** buttons on the card stay (they use `receiptLang` for the quick-action default). Only the overflow menu gains the explicit bilingual choices.

### `shareReceipt` tweak
Currently the share text is built from `lang` (UI language). Change it to use the `lng` argument so an Arabic share generates Arabic text and English share generates English text, regardless of UI language. One-line change inside the existing function — no API change.

## Out of scope
- No design changes, no other screens, no business logic.
