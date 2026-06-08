## Problem
`@codetrix-studio/capacitor-google-auth@3.4.0-rc.4` requires `@capacitor/core@^6.0.0` as a peer dependency, but the project uses `@capacitor/core@^8.3.4`. This plugin is effectively archived — the maintainers recommend migrating to `@capgo/capacitor-social-login`.

## Option A: Quick unblock with `--legacy-peer-deps` (short-term)
Add `.npmrc` with `legacy-peer-deps=true` so npm ignores the peer mismatch. This lets installs complete but does not guarantee runtime compatibility with Capacitor 8.

## Option B: Migrate to maintained plugin (recommended)
Replace `@codetrix-studio/capacitor-google-auth` with `@capgo/capacitor-social-login`, which supports Capacitor 8 and is actively maintained.

Steps:
1. Remove `@codetrix-studio/capacitor-google-auth` from `package.json`.
2. Add `@capgo/capacitor-social-login`.
3. Update `src/lib/nativeGoogleAuth.ts` to use the new plugin's Google Auth API (initialize + sign-in flow).
4. Run `npm install` and verify the build.

## Option C: Use bun instead of npm
The project already uses bun in the sandbox. If the user is running `npm install` locally, switching to `bun install` may bypass the peer-dep strictness and install cleanly.

## Decision needed
Which option do you prefer?
- **A** — Fastest, but may break at runtime on native builds.
- **B** — Cleanest and future-proof, but requires small code changes.
- **C** — Simplest if you already have bun installed locally.