import type { CapacitorConfig } from "@capacitor/cli";

// Set CAP_ENV=dev to enable hot-reload from the Lovable sandbox.
// Default (no env var) = production build ready for Xcode / App Store.
const isDev = process.env.CAP_ENV === "dev";

const config: CapacitorConfig = {
  appId: "app.lovable.c6fcf97d71d44c46b75687a26fc2bf21",
  appName: "Amlaki",
  webDir: "dist",
  ...(isDev
    ? {
        server: {
          url: "https://c6fcf97d-71d4-4c46-b756-87a26fc2bf21.lovableproject.com?forceHideBadge=true",
          cleartext: true,
        },
      }
    : {}),
  ios: {
    contentInset: "always",
    backgroundColor: "#0d1426",
  },
  android: {
    backgroundColor: "#0d1426",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      backgroundColor: "#0d1426",
      androidSplashResourceName: "splash",
      iosSplashResourceName: "Splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // Native Google Sign-In (iOS/Android only).
    // Uses @codetrix-studio/capacitor-google-auth (Google only, no Facebook SDK).
    // Fill in the same values as src/lib/nativeGoogleAuth.ts before shipping.
    GoogleAuth: {
      scopes: ["email", "profile"],
      serverClientId: "REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com",
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
