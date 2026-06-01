// Add (or increase) add-on units on an existing Paddle subscription.
// Body: { quantity: number, environment: 'sandbox' | 'live' }
// Auth: requires a logged-in user (JWT). Looks up the user's active
// subscription, resolves the matching add-on price, and PATCHes the
// subscription to add/increment the add-on item quantity. Paddle bills
// the prorated difference immediately.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Map base plan product_id -> add-on price external_id
const ADDON_PRICE_BY_PLAN: Record<string, string> = {
  amlaki_starter: 'personal_addon_unit',
  amlaki_personal: 'personal_addon_unit',
  amlaki_pro: 'pro_addon_unit',
  amlaki_business: 'business_addon_unit',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function resolvePaddlePriceId(env: PaddleEnv, externalId: string): Promise<string | null> {
  const res = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(externalId)}`);
  const data = await res.json();
  return data?.data?.[0]?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const quantity = Number(body?.quantity);
    const env = (body?.environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 500) {
      return jsonResponse({ error: 'invalid_quantity' }, 400);
    }

    // Service client to read subscription rows regardless of RLS
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .select('paddle_subscription_id, product_id, addon_units, environment, status')
      .eq('user_id', userId)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) { console.error('add-subscription-units db error', subErr); return jsonResponse({ error: 'db_error' }, 500); }
    if (!sub?.paddle_subscription_id) {
      return jsonResponse({ error: 'no_active_subscription' }, 400);
    }
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) {
      return jsonResponse({ error: 'subscription_not_active' }, 400);
    }

    const addonExternalId = ADDON_PRICE_BY_PLAN[sub.product_id];
    if (!addonExternalId) {
      return jsonResponse({ error: 'addons_not_available_for_plan' }, 400);
    }

    // Fetch current subscription items from Paddle
    const subRes = await gatewayFetch(env, `/subscriptions/${sub.paddle_subscription_id}`);
    if (!subRes.ok) {
      const text = await subRes.text();
      console.error('paddle_fetch_failed', text);
      return jsonResponse({ error: 'paddle_fetch_failed' }, 502);
    }
    const subJson = await subRes.json();
    const currentItems = subJson?.data?.items ?? [];

    const addonPaddlePriceId = await resolvePaddlePriceId(env, addonExternalId);
    if (!addonPaddlePriceId) {
      return jsonResponse({ error: 'addon_price_not_found' }, 500);
    }

    // Build new items list: keep base items, set addon item quantity to
    // currentAddonQty + quantity (in one row per addon price).
    let existingAddonQty = 0;
    const items: Array<{ price_id: string; quantity: number }> = [];
    for (const it of currentItems) {
      const pid = it?.price?.id;
      if (!pid) continue;
      if (pid === addonPaddlePriceId) {
        existingAddonQty = Number(it?.quantity ?? 0);
        continue; // skip; we'll re-add below with new quantity
      }
      items.push({ price_id: pid, quantity: Number(it?.quantity ?? 1) });
    }
    items.push({ price_id: addonPaddlePriceId, quantity: existingAddonQty + quantity });

    const patchRes = await gatewayFetch(env, `/subscriptions/${sub.paddle_subscription_id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        items,
        proration_billing_mode: 'prorated_immediately',
      }),
    });
    if (!patchRes.ok) {
      const text = await patchRes.text();
      return jsonResponse({ error: 'paddle_update_failed', details: text }, 502);
    }

    // Webhook will update addon_units; but also patch the row immediately so the UI reflects it.
    await admin
      .from('subscriptions')
      .update({ addon_units: (sub.addon_units ?? 0) + quantity, updated_at: new Date().toISOString() })
      .eq('paddle_subscription_id', sub.paddle_subscription_id)
      .eq('environment', env);

    return jsonResponse({ success: true, added: quantity, total_addon_units: (sub.addon_units ?? 0) + quantity });
  } catch (e) {
    console.error('add-subscription-units error', e);
    return jsonResponse({ error: 'internal_error', details: String(e) }, 500);
  }
});
