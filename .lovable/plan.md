## Plan: Add Capacitor icon generation scripts

### What
Add convenient npm scripts to `package.json` for generating iOS/Android app icons and syncing native platforms, so the user doesn't have to remember the long commands.

### Changes
1. Add these scripts to `package.json`:
   - `cap:icons` — generates icons for both platforms using `@capacitor/assets`
   - `cap:sync` — runs `npx cap sync ios && npx cap sync android`
   - `cap:icons:ios` / `cap:icons:android` — platform-specific icon generation

### Technical details
`@capacitor/assets` is already in `devDependencies` (v3.0.5). The command uses the brand colors already established:
- Light mode background: `#5f7e65`
- Dark mode background: `#2c3a2e`

No other files touched.