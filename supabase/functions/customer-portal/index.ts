import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, type PaddleEnv } from '../_shared/paddle.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'no auth' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: { user } } = await supabase.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'invalid user' }), { status: 401, headers: corsHeaders });

    const { environment } = await req.json().catch(() => ({}));
    const env: PaddleEnv = environment === 'live' ? 'live' : 'sandbox';

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('paddle_customer_id, paddle_subscription_id')
      .eq('user_id', user.id)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.paddle_customer_id) {
      return new Response(JSON.stringify({ error: 'no_subscription' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const paddle = getPaddleClient(env);
    const session = await paddle.customerPortalSessions.create(sub.paddle_customer_id, sub.paddle_subscription_id ? [sub.paddle_subscription_id] : []);
    return new Response(JSON.stringify({ url: session.urls.general.overview }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('customer-portal error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
