import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_KEY = "amlaki_tour_v1";

type Lang = "ar" | "en";
type Step = {
  route?: string;
  selector?: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  side?: "top" | "bottom" | "left" | "right";
};

const STEPS: Step[] = [
  {
    route: "/",
    titleAr: "أهلاً بك في أملاكي",
    titleEn: "Welcome to Amlaki",
    descAr: "سنأخذك في جولة سريعة (دقيقة واحدة) للتعرف على أهم الأقسام.",
    descEn: "Quick 1-minute tour through the key sections.",
  },
  {
    route: "/",
    selector: '[data-tour="dashboard-stats"]',
    titleAr: "نظرة سريعة على عقاراتك",
    titleEn: "Quick overview",
    descAr: "هنا ترى ملخص أداء عقاراتك: التحصيل، عدد المباني والوحدات.",
    descEn: "Here you see your portfolio at a glance: collection, buildings, units.",
    side: "bottom",
  },
  {
    route: "/",
    selector: '[data-tour="quick-payment"]',
    titleAr: "تسجيل دفعة سريعة",
    titleEn: "Quick payment",
    descAr: "سجّل أي دفعة في ثانيتين من أي صفحة عبر هذا الزر العائم.",
    descEn: "Log a payment from anywhere with this floating button.",
    side: "left",
  },
  {
    route: "/buildings",
    selector: '[data-tour="add-building"]',
    titleAr: "ابدأ بإضافة مبنى",
    titleEn: "Add your first building",
    descAr: "كل عقاراتك تبدأ هنا — أضف المبنى ثم وحداته ومستأجريه.",
    descEn: "Everything starts here — add a building, then its units and tenants.",
    side: "bottom",
  },
  {
    route: "/tenants",
    titleAr: "إدارة المستأجرين",
    titleEn: "Tenants",
    descAr: "تتبع كل مستأجر، عقده، رصيده، وحالة سداده من مكان واحد.",
    descEn: "Track every tenant, their contract, balance, and payment status.",
  },
  {
    route: "/payments",
    titleAr: "سجل المدفوعات",
    titleEn: "Payments",
    descAr: "راجع كل الدفعات، صفِّها حسب الفترة، وصدّرها متى شئت.",
    descEn: "Review all payments, filter by period, and export anytime.",
  },
  {
    route: "/reports",
    titleAr: "تقارير ذكية",
    titleEn: "Smart reports",
    descAr: "رسوم بيانية تكشف لك أداء كل مبنى ووحدة فوراً.",
    descEn: "Interactive charts revealing the performance of every property.",
  },
  {
    route: "/",
    titleAr: "جاهز للانطلاق ✦",
    titleEn: "You're all set ✦",
    descAr: "يمكنك إعادة هذه الجولة في أي وقت من زر (؟) أعلى الشاشة.",
    descEn: "Replay this tour anytime from the (?) button at the top.",
  },
];

let active: Driver | null = null;

export function startTour(opts: {
  navigate: (path: string) => void;
  currentPath: string;
  lang: Lang;
  onDone?: () => void;
}) {
  const { navigate, currentPath, lang, onDone } = opts;
  const ar = lang === "ar";

  // Cleanup any prior instance
  try { active?.destroy(); } catch {}

  const waitFor = (selector?: string, timeout = 1200): Promise<Element | null> =>
    new Promise((resolve) => {
      if (!selector) return resolve(null);
      const start = Date.now();
      const tick = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });

  const buildStep = (s: Step) => ({
    element: s.selector,
    popover: {
      title: ar ? s.titleAr : s.titleEn,
      description: ar ? s.descAr : s.descEn,
      side: s.side || "bottom",
      align: "center" as const,
      showButtons: ["next", "previous", "close"] as Array<"next" | "previous" | "close">,
      nextBtnText: ar ? "التالي ←" : "Next →",
      prevBtnText: ar ? "→ السابق" : "← Back",
      doneBtnText: ar ? "تم" : "Done",
    },
  });

  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    onDone?.();
  };

  active = driver({
    showProgress: true,
    progressText: ar ? "{{current}} من {{total}}" : "{{current}} of {{total}}",
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 14,
    smoothScroll: true,
    disableActiveInteraction: true,
    onDestroyed: finish,
    steps: STEPS.map(buildStep),
    onHighlightStarted: async (_el, step, { state, driver: d }) => {
      const idx = state.activeIndex ?? 0;
      const target = STEPS[idx];
      if (!target) return;
      if (target.route && target.route !== window.location.pathname) {
        navigate(target.route);
        const el = await waitFor(target.selector, 1500);
        // Refresh element reference after navigation
        if (target.selector) {
          d.refresh();
          if (!el) {
            // selector missing — present as modal centered
          }
        }
      }
    },
  });

  // Initial navigation if needed
  const first = STEPS[0];
  if (first?.route && first.route !== currentPath) {
    navigate(first.route);
    setTimeout(() => active?.drive(), 250);
  } else {
    active.drive();
  }
}

export function hasSeenTour(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return false; }
}

export function resetTour() {
  try { localStorage.removeItem(TOUR_KEY); } catch {}
}
