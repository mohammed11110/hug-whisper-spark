// Lightweight global bus so any page showing rents/arrears refreshes
// instantly after a payment is added, edited, deleted or restored —
// regardless of which page or dialog triggered the mutation.
//
// Built on top of window CustomEvent so it works across React trees
// without pulling react-query.

const EVENT = "amlaki:payment-added" as const;

export interface PaymentBusDetail {
  unitId?: string | null;
}

export const paymentsBus = {
  /** Notify all listeners that the payments dataset changed. */
  emit(unitId?: string | null) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<PaymentBusDetail>(EVENT, { detail: { unitId: unitId ?? null } }));
  },
  /** Subscribe to payment-mutation events. Returns an unsubscribe fn. */
  subscribe(handler: (unitId?: string | null) => void) {
    if (typeof window === "undefined") return () => {};
    const h = (e: Event) => {
      const detail = (e as CustomEvent<PaymentBusDetail>).detail || {};
      handler(detail.unitId ?? null);
    };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  },
};
