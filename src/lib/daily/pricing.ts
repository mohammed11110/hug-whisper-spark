// Daily-rental pricing engine.
// Priority: matching seasonal rule > weekend multiplier (Thu/Fri) > base price.

export interface DailyUnitPricing {
  id: string;
  base_price: number;
  weekend_multiplier: number;
}

export interface PricingRule {
  id: string;
  unit_id: string | null; // null => applies to all units in the building
  start_date: string; // YYYY-MM-DD
  end_date: string;
  price_per_night: number;
  priority: number;
  min_stay: number;
}

const WEEKEND_DAYS = new Set([4, 5]); // Thu(4), Fri(5) — Gulf weekend

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function priceForNight(
  date: Date,
  unit: DailyUnitPricing,
  rules: PricingRule[],
): { price: number; source: "rule" | "weekend" | "base"; ruleName?: string } {
  const dateStr = ymd(date);
  const applicable = rules
    .filter(
      (r) =>
        (r.unit_id === null || r.unit_id === unit.id) &&
        isInRange(dateStr, r.start_date, r.end_date),
    )
    .sort((a, b) => b.priority - a.priority);

  if (applicable.length > 0) {
    return { price: Number(applicable[0].price_per_night), source: "rule" };
  }

  const dow = date.getDay();
  if (WEEKEND_DAYS.has(dow)) {
    return {
      price: Number(unit.base_price) * Number(unit.weekend_multiplier || 1),
      source: "weekend",
    };
  }

  return { price: Number(unit.base_price), source: "base" };
}

export function calculateStay(
  checkIn: string, // YYYY-MM-DD
  checkOut: string,
  unit: DailyUnitPricing,
  rules: PricingRule[],
): { nights: number; total: number; breakdown: Array<{ date: string; price: number; source: string }> } {
  const start = new Date(checkIn + "T00:00:00");
  const end = new Date(checkOut + "T00:00:00");
  const breakdown: Array<{ date: string; price: number; source: string }> = [];
  let total = 0;
  let nights = 0;
  const d = new Date(start);
  while (d < end) {
    const r = priceForNight(d, unit, rules);
    breakdown.push({ date: ymd(d), price: r.price, source: r.source });
    total += r.price;
    nights += 1;
    d.setDate(d.getDate() + 1);
  }
  return { nights, total, breakdown };
}
