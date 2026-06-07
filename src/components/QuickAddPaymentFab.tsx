import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { useI18n } from "@/lib/i18n";

const HIDDEN_PREFIXES = [
  "/auth",
  "/welcome",
  "/install",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/admin",
  "/daily",
  "/unsubscribe",
  "/privacy",
  "/terms",
  "/refund",
];

const STORAGE_KEY = "amlaki_fab_pos_v1";
const SIZE = 56; // bubble diameter
const EDGE_MARGIN = 12; // gap from screen edge
const DRAG_THRESHOLD = 4; // px — below this counts as a tap
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

type Pos = { side: "left" | "right"; ratioY: number };

const DEFAULT_POS: Pos = { side: "right", ratioY: 0.78 };

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POS;
    const p = JSON.parse(raw);
    if (p && (p.side === "left" || p.side === "right") && typeof p.ratioY === "number") {
      return { side: p.side, ratioY: Math.min(0.98, Math.max(0.02, p.ratioY)) };
    }
  } catch {}
  return DEFAULT_POS;
}

function savePos(p: Pos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export function resetFabPosition() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  window.dispatchEvent(new CustomEvent("amlaki:fab-reset"));
}

function safeInsets() {
  // Approximate: top app bar ~64, bottom nav ~88 on mobile.
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  return {
    top: 72,
    bottom: isMobile ? 96 : 24,
  };
}

function vibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.(ms);
    }
  } catch {}
}

export function QuickAddPaymentFab() {
  const { lang } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => (typeof window !== "undefined" ? loadPos() : DEFAULT_POS));
  const [dragging, setDragging] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    moved: false,
    pointerId: -1 as number,
    reduceMotion: false,
  });

  // Listen for external reset
  useEffect(() => {
    const onReset = () => setPos(DEFAULT_POS);
    window.addEventListener("amlaki:fab-reset", onReset);
    return () => window.removeEventListener("amlaki:fab-reset", onReset);
  }, []);

  // Cache reduced motion preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    stateRef.current.reduceMotion = mq.matches;
    const onChange = () => { stateRef.current.reduceMotion = mq.matches; };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Compute initial absolute position from ratio
  const computeXY = useCallback((p: Pos) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ins = safeInsets();
    const minY = ins.top;
    const maxY = vh - SIZE - ins.bottom;
    const y = Math.min(maxY, Math.max(minY, p.ratioY * vh - SIZE / 2));
    const x = p.side === "left" ? EDGE_MARGIN : vw - SIZE - EDGE_MARGIN;
    return { x, y };
  }, []);

  // Apply transform when not dragging
  useEffect(() => {
    if (!btnRef.current) return;
    if (dragging) return;
    const { x, y } = computeXY(pos);
    stateRef.current.curX = x;
    stateRef.current.curY = y;
    const reduce = stateRef.current.reduceMotion;
    btnRef.current.style.transition = reduce
      ? "transform 0ms, box-shadow 150ms ease-out"
      : `transform 380ms ${SPRING}, box-shadow 150ms ease-out`;
    btnRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [pos, dragging, computeXY]);

  // Reposition on resize / orientation change
  useEffect(() => {
    const onResize = () => setPos((p) => ({ ...p }));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return;
    btnRef.current.setPointerCapture(e.pointerId);
    const { x, y } = stateRef.current.curX || stateRef.current.curY
      ? { x: stateRef.current.curX, y: stateRef.current.curY }
      : computeXY(pos);
    stateRef.current.startX = e.clientX - x;
    stateRef.current.startY = e.clientY - y;
    stateRef.current.curX = x;
    stateRef.current.curY = y;
    stateRef.current.moved = false;
    stateRef.current.pointerId = e.pointerId;
    setDragging(true);
    btnRef.current.style.transition = "box-shadow 150ms ease-out, transform 0ms";
    vibrate(8);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stateRef.current.pointerId !== e.pointerId) return;
    if (!btnRef.current) return;
    const nx = e.clientX - stateRef.current.startX;
    const ny = e.clientY - stateRef.current.startY;
    const dx = nx - (computeXY(pos).x);
    const dy = ny - (computeXY(pos).y);
    if (!stateRef.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      stateRef.current.moved = true;
    }
    stateRef.current.curX = nx;
    stateRef.current.curY = ny;
    btnRef.current.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stateRef.current.pointerId !== e.pointerId) return;
    stateRef.current.pointerId = -1;
    const wasDrag = stateRef.current.moved;
    setDragging(false);

    if (!wasDrag) {
      // Treat as tap → open dialog
      setOpen(true);
      return;
    }

    // Snap to nearest horizontal edge
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ins = safeInsets();
    const minY = ins.top;
    const maxY = vh - SIZE - ins.bottom;

    const cx = stateRef.current.curX + SIZE / 2;
    const side: "left" | "right" = cx < vw / 2 ? "left" : "right";
    const clampedY = Math.min(maxY, Math.max(minY, stateRef.current.curY));
    const ratioY = (clampedY + SIZE / 2) / vh;
    const next: Pos = { side, ratioY };
    savePos(next);
    setPos(next);
    vibrate(12);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stateRef.current.pointerId !== e.pointerId) return;
    stateRef.current.pointerId = -1;
    setDragging(false);
    setPos((p) => ({ ...p })); // re-snap to current pos
  };

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-tour="quick-payment"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={lang === "ar" ? "تسجيل دفعة" : "Register payment"}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: SIZE,
          height: SIZE,
          borderRadius: "9999px",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          zIndex: 60,
          background: "linear-gradient(135deg, #e0c068 0%, #c9a44c 100%)",
          color: "#1a1f2b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: dragging ? "grabbing" : "grab",
          boxShadow: dragging
            ? "0 18px 40px -10px rgba(201,164,76,0.65), 0 6px 16px rgba(0,0,0,0.25)"
            : "0 12px 32px -8px rgba(201,164,76,0.55), 0 4px 12px rgba(0,0,0,0.18)",
          transform: `translate3d(${stateRef.current.curX || 0}px, ${stateRef.current.curY || 0}px, 0) scale(${dragging ? 1.08 : 1})`,
          transition: dragging
            ? "box-shadow 150ms ease-out, transform 0ms"
            : `transform 380ms ${SPRING}, box-shadow 150ms ease-out`,
          willChange: "transform",
        }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.6} />
      </button>
      <AddPaymentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
