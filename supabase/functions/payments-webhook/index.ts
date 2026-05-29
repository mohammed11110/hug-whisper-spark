import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhookAuto, EventName, type PaddleEnv } from '../_shared/paddle.ts';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }
  return _supabase;
}

// Map product external_id -> plan label stored in profiles.subscription_plan
const PRODUCT_TO_PLAN: Record<string, string> = {
  amlaki_starter: 'personal', // legacy product, now treated as Personal
  amlaki_personal: 'personal',
  amlaki_pro: 'pro',
  amlaki_business: 'business',
  amlaki_enterprise: 'enterprise',
};

const ADDON_PRODUCTS = new Set([
  'amlaki_personal_addon',
  'amlaki_pro_addon',
  'amlaki_business_addon',
]);

function pickPrimaryItem(items: any[]): any | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  return (
    items.find(
      (it) =>
        it?.product?.importMeta?.externalId &&
        !ADDON_PRODUCTS.has(it.product.importMeta.externalId),
    ) ?? items[0]
  );
}

function sumAddonUnits(items: any[]): number {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const it of items) {
    const ext = it?.product?.importMeta?.externalId;
    if (ext && ADDON_PRODUCTS.has(ext)) {
      total += Number(it.quantity ?? 0);
    }
  }
  return total;
}

async function syncProfile(userId: string, fields: Record<string, unknown>) {
  await getSupabase()
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData, nextBilledAt } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error('No userId in customData');
    return;
  }
  const item = pickPrimaryItem(items);
  if (!item) {
    console.warn('Skipping subscription: no items');
    return;
  }
  const priceId = item.price?.importMeta?.externalId;
  const productId = item.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn('Skipping subscription: missing importMeta.externalId', {
      rawPriceId: item.price?.id,
      rawProductId: item.product?.id,
    });
    return;
  }

  const addonUnits = sumAddonUnits(items);
  const trialEndsAt = status === 'trialing' ? (currentBillingPeriod?.endsAt || nextBilledAt) : null;
  const planLabel = PRODUCT_TO_PLAN[productId] || 'pro';
  const interval = item.price.billingCycle?.interval === 'year' ? 'yearly' : 'monthly';

  await getSupabase().from('subscriptions').upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      trial_ends_at: trialEndsAt,
      addon_units: addonUnits,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'paddle_subscription_id' },
  );

  // Sync the legacy fields on profiles so the rest of the app keeps working.
  await syncProfile(userId, {
    subscription_plan: planLabel,
    subscription_status: status,
    subscription_interval: interval,
    subscription_expires_at: currentBillingPeriod?.endsAt,
    trial_ends_at: trialEndsAt,
    paddle_customer_id: customerId,
    paddle_subscription_id: id,
    canceled_at: null,
  });
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, customData, items } = data;
  const addonUnits = sumAddonUnits(items);
  const primary = pickPrimaryItem(items);
  const productId = primary?.product?.importMeta?.externalId;
  const priceId = primary?.price?.importMeta?.externalId;

  await getSupabase()
    .from('subscriptions')
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      addon_units: addonUnits,
      ...(productId ? { product_id: productId } : {}),
      ...(priceId ? { price_id: priceId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  const userId = customData?.userId;
  if (userId) {
    const planLabel = productId ? PRODUCT_TO_PLAN[productId] : undefined;
    const interval = primary?.price?.billingCycle?.interval === 'year' ? 'yearly' : 'monthly';
    await syncProfile(userId, {
      subscription_status: status,
      subscription_expires_at: currentBillingPeriod?.endsAt,
      ...(planLabel ? { subscription_plan: planLabel, subscription_interval: interval } : {}),
    });
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);

  const userId = data.customData?.userId;
  if (userId) {
    await syncProfile(userId, {
      subscription_status: 'canceled',
      canceled_at: new Date().toISOString(),
    });
  }
}

async function logEvent(event: any, env: PaddleEnv) {
  try {
    const userId = event.data?.customData?.userId;
    if (!userId) return;
    await getSupabase().from('subscription_events').insert({
      user_id: userId,
      event_type: event.eventType,
      paddle_event_id: event.eventId,
      paddle_subscription_id: event.data?.subscriptionId || event.data?.id,
      paddle_transaction_id: event.data?.id?.startsWith?.('txn_') ? event.data.id : null,
      amount: event.data?.details?.totals?.total
        ? Number(event.data.details.totals.total) / 100
        : null,
      currency: event.data?.currencyCode || event.data?.details?.totals?.currencyCode,
      invoice_url: event.data?.invoice_pdf_url || null,
      payload: event.data,
      occurred_at: event.occurredAt || new Date().toISOString(),
    });
  } catch (e) {
    console.error('logEvent error', e);
  }
  // env is intentionally available for future routing but not stored here
  void env;
}

async function handleWebhook(req: Request) {
  const { event, env } = await verifyWebhookAuto(req);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionActivated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    default:
      console.log('Unhandled event:', event.eventType);
  }
  await logEvent(event, env);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    await handleWebhook(req);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});

