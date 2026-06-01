// Trial + grace lifecycle dispatcher (hourly via pg_cron).
// Sends staged notifications (email + in_app) and promotes accounts through:
//   trial → readonly_grace (D14) → deleted (D44)
// Also handles paid-subscription cancellation grace (kept from previous version).
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
  | 'data-deleted';

interface Copy { title_ar: string; title_en: string; body_ar: string; body_en: string; action_url: string; subject: string; }

const COPY: Record<Kind, Copy> = {
  'trial-d10': {
    title_ar: 'تنتهي تجربتك بعد 4 أيام',
    title_en: 'Your trial ends in 4 days',
    body_ar: 'استمتع بجميع الميزات. اشترك الآن للاحتفاظ ببياناتك ووصولك الكامل.',
    body_en: 'Enjoy all features. Subscribe now to keep your data and full access.',
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
    title_ar: 'انتهت تجربتك — بياناتك محفوظة 30 يوماً',
    title_en: 'Trial ended — your data is kept for 30 days',
    body_ar: 'حسابك الآن في وضع القراءة فقط. يمكنك التصدير أو الاشتراك في أي وقت.',
    body_en: 'Your account is now read-only. You can export or subscribe at any time.',
    action_url: '/pricing',
    subject: 'انتهت تجربتك — بياناتك محفوظة',
  },
  'grace-d7': {
    title_ar: '23 يوماً قبل حذف البيانات',
    title_en: '23 days before data deletion',
    body_ar: 'اشترك الآن لاستعادة الوصول الكامل والاحتفاظ ببياناتك.',
    body_en: 'Subscribe now to restore full access and keep your data.',
    action_url: '/pricing',
    subject: 'تذكير: 23 يوماً قبل حذف بياناتك',
  },
  'grace-d37': {
    title_ar: 'تحذير: يتم حذف بياناتك خلال 7 أيام',
    title_en: 'Warning: data deleted in 7 days',
    body_ar: 'صدّر بياناتك أو اشترك الآن لتفادي الحذف النهائي.',
    body_en: 'Export your data or subscribe now to avoid permanent deletion.',
    action_url: '/pricing',
    subject: 'تحذير: حذف بياناتك خلال 7 أيام',
  },
  'grace-d43': {
    title_ar: 'تحذير أخير: الحذف غداً',
    title_en: 'Final warning: deletion tomorrow',
    body_ar: 'سيتم حذف بياناتك بشكل نهائي خلال 24 ساعة. صدّرها الآن أو اشترك للاحتفاظ بها.',
    body_en: 'Your data will be permanently deleted in 24 hours. Export now or subscribe to keep it.',
    action_url: '/backup',
    subject: 'تحذير أخير: حذف بياناتك غداً',
  },
  'data-deleted': {
    title_ar: 'تم حذف بياناتك',
    title_en: 'Your data has been deleted',
    body_ar: 'تم حذف بيانات حسابك نهائياً. يمكنك إنشاء حساب جديد في أي وقت.',
    body_en: 'Your account data has been permanently deleted. You can start fresh anytime.',
    action_url: '/',
    subject: 'تم حذف بياناتك من أملاكي',
  },
};

function emailHtml(c: Copy, name: string) {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:-apple-system,Tahoma,Arial;background:#faf6ee;padding:32px;color:#2c3a2e">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid rgba(95,126,101,.12)">
<h1 style="color:#5f7e65;font-size:24px;margin:0 0 16px">أملاكي</h1>
<h2 style="font-size:20px;margin:0 0 12px">${c.title_ar}</h2>
<p style="font-size:15px;line-height:1.7;color:#4a5a4d">مرحباً ${name || 'عميلنا الكريم'}،</p>
<p style="font-size:15px;line-height:1.7">${c.body_ar}</p>
<div style="margin:24px 0">
<a href="https://amlaki1.app${c.action_url}" style="display:inline-block;background:#a89456;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700">${c.action_url === '/backup' ? 'تصدير البيانات' : 'اشترك الآن'}</a>
</div>
<hr style="border:none;border-top:1px solid rgba(95,126,101,.12);margin:24px 0">
<p style="font-size:12px;color:#7a8e9a">فريق أملاكي — إدارة عقاراتك بذكاء وأناقة</p>
</div></body></html>`;
}

async function notify(userId: string, email: string | null, name: string, kind: Kind) {
  const a = admin();
  const c = COPY[kind];

  // In-app (idempotent via notification_log)
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

  // Email (idempotent)
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

  // Push (best-effort; only if user has tokens)
  try {
    const { data: tokens } = await a.from('push_subscriptions').select('id').eq('user_id', userId).limit(1);
    if (tokens && tokens.length > 0) {
      const { data: pushSent } = await a.from('notification_log')
        .select('id').eq('user_id', userId).eq('kind', kind).eq('channel', 'push').maybeSingle();
      if (!pushSent) {
        // Edge function 'send-push' is optional; ignore failures
        try {
          await a.functions.invoke('send-push', { body: { user_id: userId, title: c.title_ar, body: c.body_ar, url: c.action_url } });
        } catch (_) {}
        await a.from('notification_log').insert({ user_id: userId, kind, channel: 'push' });
      }
    }
  } catch (_) {}
}

async function deleteUserData(userId: string) {
  const a = admin();
  const { data: buildings } = await a.from('buildings').select('id').eq('user_id', userId);
  const bIds = (buildings ?? []).map((b: any) => b.id);
  if (bIds.length) {
    const { data: units } = await a.from('units').select('id').in('building_id', bIds);
    const uIds = (units ?? []).map((u: any) => u.id);
    if (uIds.length) await a.from('payments').delete().in('unit_id', uIds);
    await a.from('expenses').delete().in('building_id', bIds);
    await a.from('tenancies').delete().in('building_id', bIds);
    await a.from('maintenance_requests').delete().in('building_id', bIds);
    await a.from('daily_bookings').delete().in('building_id', bIds);
    await a.from('daily_units').delete().in('building_id', bIds);
    await a.from('daily_cleaning_tasks').delete().in('building_id', bIds);
    await a.from('daily_pricing_rules').delete().in('building_id', bIds);
    await a.from('daily_cleaners').delete().in('building_id', bIds);
    await a.from('daily_message_templates').delete().in('building_id', bIds);
    await a.from('units').delete().in('building_id', bIds);
    await a.from('buildings').delete().in('id', bIds);
  }
}

async function run() {
  const a = admin();
  const now = new Date();
  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1);

  // Pull all non-deleted profiles with trial info
  const { data: profiles } = await a
    .from('profiles')
    .select('id, email, name, trial_ends_at, grace_ends_at, subscription_status')
    .neq('subscription_status', 'deleted');

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

    // Trial ended: ensure grace_ends_at is set
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
      // Delete data permanently
      await deleteUserData(p.id);
      await a.from('profiles').update({
        subscription_status: 'deleted', updated_at: now.toISOString(),
      }).eq('id', p.id);
      await notify(p.id, p.email, p.name ?? '', 'data-deleted');
      bump('deleted');
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
