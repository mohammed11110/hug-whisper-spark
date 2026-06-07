// Subscription + trial lifecycle dispatcher (hourly via pg_cron).
// Sends staged notifications (email + in_app) and promotes accounts through:
//   trial → readonly_grace (D14) → frozen (D44, data preserved, NEVER deleted)
// Also sends Stage 0 pre-renewal reminder 3 days before paid renewals.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GRACE_DAYS = 30;

function admin() { return createClient(SUPABASE_URL, SERVICE); }

type Kind =
  | 'trial-d10' | 'trial-d13' | 'trial-ended'
  | 'grace-d7' | 'grace-d37' | 'grace-d43'
  | 'account-frozen'
  | 'renewal-d3';

interface Copy { title_ar: string; title_en: string; body_ar: string; body_en: string; action_url: string; subject: string; }

const COPY: Record<Kind, Copy> = {
  'trial-d10': {
    title_ar: 'تنتهي تجربتك بعد 4 أيام',
    title_en: 'Your trial ends in 4 days',
    body_ar: 'استمتع بجميع الميزات. اشترك الآن للاحتفاظ بوصولك الكامل.',
    body_en: 'Enjoy all features. Subscribe now to keep full access.',
    action_url: '/pricing',
    subject: 'تنتهي تجربتك المجانية بعد 4 أيام',
  },
  'trial-d13': {
    title_ar: 'تنتهي تجربتك غداً',
    title_en: 'Your trial ends tomorrow',
    body_ar: 'اشترك الآن لمواصلة إدارة عقاراتك دون انقطاع.',
    body_en: 'Subscribe now to keep managing your properties without interruption.',
    action_url: '/pricing',
    subject: 'تنتهي تجربتك غداً — اشترك الآن',
  },
  'trial-ended': {
    title_ar: 'انتهت تجربتك — بياناتك محفوظة',
    title_en: 'Trial ended — your data is preserved',
    body_ar: 'حسابك في وضع القراءة فقط الآن. كل بياناتك آمنة ويمكنك الاشتراك في أي وقت لاستعادة الوصول الكامل.',
    body_en: 'Your account is now read-only. All your data is safe — subscribe anytime to restore full access.',
    action_url: '/pricing',
    subject: 'انتهت تجربتك — بياناتك محفوظة',
  },
  'grace-d7': {
    title_ar: 'تذكير: حسابك في وضع القراءة فقط',
    title_en: 'Reminder: your account is read-only',
    body_ar: 'اشترك لاستعادة الوصول الكامل وإضافة وحدات جديدة.',
    body_en: 'Subscribe to restore full access and add new units.',
    action_url: '/pricing',
    subject: 'تذكير من أملاكي — جدّد اشتراكك',
  },
  'grace-d37': {
    title_ar: 'بياناتك لا تزال محفوظة',
    title_en: 'Your data is still safely stored',
    body_ar: 'اشترك في أي وقت لاستعادة الوصول الكامل فوراً. لن يتم حذف أي شيء.',
    body_en: 'Subscribe anytime to instantly restore full access. Nothing will be deleted.',
    action_url: '/pricing',
    subject: 'بياناتك محفوظة في أملاكي',
  },
  'grace-d43': {
    title_ar: 'سيتم تجميد حسابك قريباً (مع الاحتفاظ بكل البيانات)',
    title_en: 'Your account will be frozen soon (all data preserved)',
    body_ar: 'سيتحوّل حسابك إلى وضع المحفوظ بأمان. لا يتم حذف أي بيانات — يكفي تجديد الاشتراك لاستعادة كل شيء فوراً.',
    body_en: 'Your account will move to safe storage. No data is ever deleted — just renew to instantly restore everything.',
    action_url: '/pricing',
    subject: 'تجميد آمن لحسابك في أملاكي',
  },
  'account-frozen': {
    title_ar: 'حسابك الآن في وضع المحفوظ بأمان',
    title_en: 'Your account is now safely stored',
    body_ar: 'كل بياناتك محفوظة بالكامل. جدّد الاشتراك متى شئت لاستعادة الوصول فوراً.',
    body_en: 'All your data is fully preserved. Renew anytime to instantly restore access.',
    action_url: '/pricing',
    subject: 'حسابك في أملاكي محفوظ بأمان',
  },
  'renewal-d3': {
    title_ar: 'اشتراكك يُجدّد خلال 3 أيام',
    title_en: 'Your subscription renews in 3 days',
    body_ar: 'تأكّد من تحديث طريقة الدفع لتفادي أي انقطاع.',
    body_en: 'Make sure your payment method is up to date to avoid interruption.',
    action_url: '/settings',
    subject: 'تذكير بتجديد اشتراكك في أملاكي',
  },
};

function escHtml(v: string) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emailHtml(c: Copy, name: string) {
  const safeName = escHtml(name || 'عميلنا الكريم');
  return `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:-apple-system,Tahoma,Arial;background:#faf6ee;padding:32px;color:#2c3a2e">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid rgba(95,126,101,.12)">
<h1 style="color:#9b7e3a;font-size:24px;margin:0 0 16px">أملاكي</h1>
<h2 style="font-size:20px;margin:0 0 12px">${c.title_ar}</h2>
<p style="font-size:15px;line-height:1.7;color:#4a5a4d">مرحباً ${safeName}،</p>
<p style="font-size:15px;line-height:1.7">${c.body_ar}</p>
<div style="margin:24px 0">
<a href="https://amlaki1.app${c.action_url}" style="display:inline-block;background:#a89456;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700">جدّد الاشتراك</a>
</div>
<hr style="border:none;border-top:1px solid rgba(95,126,101,.12);margin:24px 0">
<p style="font-size:12px;color:#7a8e9a">فريق أملاكي — إدارة عقاراتك بذكاء وأناقة</p>
</div></body></html>`;
}

async function notify(userId: string, email: string | null, name: string, kind: Kind) {
  const a = admin();
  const c = COPY[kind];

  const { data: existing } = await a.from('notification_log')
    .select('id').eq('user_id', userId).eq('kind', kind).eq('channel', 'in_app').maybeSingle();
  if (!existing) {
    await a.from('in_app_notifications').insert({
      user_id: userId, kind,
      title_ar: c.title_ar, title_en: c.title_en,
      body_ar: c.body_ar, body_en: c.body_en,
      action_url: c.action_url,
    });
    await a.from('notification_log').insert({ user_id: userId, kind, channel: 'in_app' });
  }

  if (email) {
    const { data: emailSent } = await a.from('notification_log')
      .select('id').eq('user_id', userId).eq('kind', kind).eq('channel', 'email').maybeSingle();
    if (!emailSent) {
      try {
        await a.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: { to: email, subject: c.subject, html: emailHtml(c, name), template_name: kind },
        });
        await a.from('notification_log').insert({ user_id: userId, kind, channel: 'email' });
      } catch (e) {
        console.error('email enqueue failed', kind, userId, e);
      }
    }
  }

  try {
    const { data: tokens } = await a.from('push_subscriptions').select('id').eq('user_id', userId).limit(1);
    if (tokens && tokens.length > 0) {
      const { data: pushSent } = await a.from('notification_log')
        .select('id').eq('user_id', userId).eq('kind', kind).eq('channel', 'push').maybeSingle();
      if (!pushSent) {
        try {
          await a.functions.invoke('send-push', { body: { user_id: userId, title: c.title_ar, body: c.body_ar, url: c.action_url } });
        } catch (_) {}
        await a.from('notification_log').insert({ user_id: userId, kind, channel: 'push' });
      }
    }
  } catch (_) {}
}

async function run() {
  const a = admin();
  const now = new Date();
  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1);

  // STAGE 0 — pre-renewal reminders for active paid subscriptions (3 days out)
  {
    const upper = new Date(now.getTime() + 3 * 86400000).toISOString();
    const lower = new Date(now.getTime() + 2 * 86400000).toISOString();
    const { data: renewals } = await a
      .from('subscriptions')
      .select('user_id, current_period_end, cancel_at_period_end, status')
      .eq('environment', 'live')
      .in('status', ['active', 'trialing'])
      .eq('cancel_at_period_end', false)
      .gte('current_period_end', lower)
      .lte('current_period_end', upper);
    for (const r of (renewals ?? []) as any[]) {
      const { data: profile } = await a
        .from('profiles')
        .select('email, name')
        .eq('id', r.user_id)
        .maybeSingle();
      if (!profile) continue;
      await notify(r.user_id, profile.email, profile.name ?? '', 'renewal-d3');
      bump('renewal-d3');
    }
  }

  // Pull all non-frozen, non-deleted profiles with trial info
  const { data: profiles } = await a
    .from('profiles')
    .select('id, email, name, trial_ends_at, grace_ends_at, subscription_status')
    .not('subscription_status', 'in', '(deleted,frozen)');

  for (const p of (profiles ?? []) as any[]) {
    if (!p.trial_ends_at) continue;
    // Skip users who already have an active paid subscription
    const { data: sub } = await a
      .from('subscriptions')
      .select('status, current_period_end, data_delete_at')
      .eq('user_id', p.id)
      .eq('environment', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const hasActivePaidSub = sub && (
      (['active', 'trialing', 'past_due'].includes(sub.status) &&
        (!sub.current_period_end || new Date(sub.current_period_end) > now)) ||
      (sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end) > now)
    );
    if (hasActivePaidSub) continue;

    const trialEnd = new Date(p.trial_ends_at);
    const msToTrialEnd = trialEnd.getTime() - now.getTime();
    const daysToTrialEnd = Math.ceil(msToTrialEnd / 86400000);

    // TRIAL phase notifications
    if (msToTrialEnd > 0) {
      if (daysToTrialEnd <= 4 && daysToTrialEnd > 1) { await notify(p.id, p.email, p.name ?? '', 'trial-d10'); bump('d10'); }
      else if (daysToTrialEnd <= 1) { await notify(p.id, p.email, p.name ?? '', 'trial-d13'); bump('d13'); }
      continue;
    }

    // Trial ended → 30-day read-only grace
    let graceEnd: Date;
    if (!p.grace_ends_at) {
      graceEnd = new Date(trialEnd.getTime() + GRACE_DAYS * 86400000);
      await a.from('profiles').update({
        grace_ends_at: graceEnd.toISOString(),
        subscription_status: 'readonly_grace',
        updated_at: now.toISOString(),
      }).eq('id', p.id);
      await notify(p.id, p.email, p.name ?? '', 'trial-ended');
      bump('trial-ended');
      continue;
    } else {
      graceEnd = new Date(p.grace_ends_at);
    }

    const msToGraceEnd = graceEnd.getTime() - now.getTime();
    const daysToGraceEnd = Math.ceil(msToGraceEnd / 86400000);

    if (msToGraceEnd <= 0) {
      // STAGE 3 — Safe Freeze. DATA IS NEVER DELETED. Account is frozen,
      // all property data stays intact in the database and is instantly
      // restorable when the user renews.
      await a.from('profiles').update({
        subscription_status: 'frozen', updated_at: now.toISOString(),
      }).eq('id', p.id);
      await notify(p.id, p.email, p.name ?? '', 'account-frozen');
      bump('frozen');
    } else if (daysToGraceEnd <= 1) {
      await notify(p.id, p.email, p.name ?? '', 'grace-d43'); bump('d43');
    } else if (daysToGraceEnd <= 7) {
      await notify(p.id, p.email, p.name ?? '', 'grace-d37'); bump('d37');
    } else if (daysToGraceEnd <= 23) {
      await notify(p.id, p.email, p.name ?? '', 'grace-d7'); bump('d7');
    }
  }

  return stats;
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: service_role only. pg_cron caller already sends the service-role JWT.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const claims = parseJwtClaims(token);
  if (claims?.role !== 'service_role') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const stats = await run();
    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('subscription-lifecycle error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
