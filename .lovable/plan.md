## Problem

In Settings page, the tile **Tools → "بيانات المؤسسة" (Organization info)** does nothing when tapped. It is supposed to open the **Brand (الهوية)** tab, but:

1. The Tabs component is **uncontrolled** (`defaultValue="account"`), so it cannot be switched programmatically from outside.
2. The tile's `onClick` queries `button[role="tab"][value="brand"]`, but Radix `TabsTrigger` does **not** expose `value` as an HTML attribute — so the selector never matches and the click never fires.
3. The wrapping `<Link to="#brand">` only updates the URL hash; it doesn't switch tabs.

Result: tap = nothing happens (or just adds `#brand` to the URL).

## Fix (UI-only, in `src/pages/Settings.tsx`)

1. Make the Tabs **controlled**:
   - Add `const [tab, setTab] = useState<"account"|"brand"|"notify"|"print"|"secure">("account");`
   - Change `<Tabs defaultValue="account" …>` → `<Tabs value={tab} onValueChange={(v) => setTab(v as any)} …>`

2. Replace the broken "Organization info" tile:
   - Change `<Link to="#brand" onClick={…querySelector…}>` to a plain `<button>` that:
     - Calls `setTab("brand")`
     - Scrolls smoothly to the Tabs section (using a `ref` on the tabs `<section>`)
   - Keep all existing styling and copy unchanged.

3. On mount, if `location.hash === "#brand"` (e.g. from an old link), set `tab` to `"brand"` and scroll to the tabs section — so deep links keep working.

No business logic, no backend, no schema changes. Only the Settings page presentation.

## Verification

- Open `/settings` → scroll to **الأدوات** → tap **بيانات المؤسسة** → page scrolls to the tabs row and the **الهوية / Brand** tab becomes active, revealing the WhatsApp + logo/name/landlord/phone/address form.
- Other tab triggers (Account, Alerts, Print, Security) still work normally.
