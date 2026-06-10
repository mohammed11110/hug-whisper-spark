Make the saved signature preview larger and more prominent inside the Settings > Brand tab.

Changes:

1. **SignatureManager.tsx** — enlarge the preview area:
   - Increase the preview container from `min-h-[120px]` to `min-h-[200px]` and remove the `max-h-[110px]` cap on the image so the signature renders at a readable size.
   - Keep the placeholder text and loading state unchanged.
   - Ensure the existing action buttons (Redraw / Upload / Refresh / Delete) remain below the preview.

2. **Settings.tsx brand tab** — keep `SignatureManager` in its current position between the tab switcher card and the pricing link.

No data or logic changes. Only visual sizing adjustments.