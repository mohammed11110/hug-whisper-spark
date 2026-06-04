# Plan

## What I’ll change
1. **Make the suggested receipt number update from the latest backend value**
   - Adjust the add-payment dialog so it does not fill the receipt field from an old local snapshot taken before the counter refresh finishes.
   - The displayed suggestion will update only after the fresh counter arrives from the backend.

2. **Protect manual edits**
   - Keep auto-suggestion behavior only while the receipt field is still untouched/default.
   - If you manually type a custom receipt number, the app will not overwrite it during refresh.

3. **Unify the source used in the dialog**
   - Ensure preview/save logic in the add-payment flow uses the same resolved suggestion logic, so what the user sees matches what the dialog intends to use.

## Expected result
- Opening **إضافة دفعة جديدة** on browser, iPhone, iPad, and other devices will show the same next suggested receipt number.
- The actual saved receipt numbering remains backend-controlled and conflict-free.
- No database schema changes are needed.

## Technical details
- Root cause is in `src/components/AddPaymentDialog.tsx`:
  - `refreshReceiptCounter()` is called on open,
  - but `setReceipt(formatReceipt(settings.receipt))` still runs from the older render snapshot,
  - so the input can keep a stale number even after the counter refresh completes.
- I’ll move this to a reactive flow tied to the refreshed receipt settings, with a guard so custom user input is not replaced.

## Files likely involved
- `src/components/AddPaymentDialog.tsx`
- possibly a very small supporting tweak in `src/lib/appSettings.tsx` only if needed, but I’ll avoid widening scope unless necessary.