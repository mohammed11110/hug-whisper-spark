import { QueryClient } from "@tanstack/react-query";

// Singleton react-query client, shared across the app so non-React code
// (e.g. paymentsBus) can invalidate queries directly.
export const queryClient = new QueryClient();
