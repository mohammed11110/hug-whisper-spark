import { Logo } from "@/components/Logo";

export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background"
      role="status"
      aria-live="polite"
    >
      <Logo size={56} />
      <div
        className="h-8 w-8 rounded-full border-2 border-sage-200 border-t-primary motion-safe:animate-spin"
        aria-hidden
      />
      <span className="sr-only">جاري التحميل… Loading…</span>
    </div>
  );
}

export default LoadingScreen;
