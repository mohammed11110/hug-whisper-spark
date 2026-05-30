// Subscription lifecycle dispatcher (runs hourly via pg_cron).
// 1. Promote canceled subs past current_period_end → grace + set data_delete_at.
// 2. Send 7-day and 1-day reminder emails (idempotent via last_reminder_kind).
// 3. Promote grace past data_delete_at → deleted + permanently delete user data.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GRACE_DAYS = 30;

function admin() {
  return createClient(SUPABASE_URL, SERVICE);
}

async function sendReminder(
  email: string,
  recipientName: string,
  kind: 'grace-started' | 'grace-7-days' | 'grace-1-day' | 'data-deleted',
  daysLeft: number,
) {
  try {
    const subjects: Record<string, string> = {
      'grace-started': 'انتهى اشتراك أملاكي — بياناتك محفوظة 30 يوماً',
      'grace-7-days': 'تذكير: 7 أيام متبقية قبل حذف بياناتك',
      'grace-1-day': 'تحذير أخير: سيتم حذف بياناتك خلال 24 ساعة',
      'data-deleted': 'تم حذف بياناتك من أملاكي',
    };
    const dashboardUrl = `https://amlaki1.app/settings`;
    const exportUrl = `https://amlaki1.app/backup`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:-apple-system,Tahoma,Arial;background:#faf6ee;padding:32px;color:#2c3a2e">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid rgba(95,126,101,.12)">
<h1 style="color:#5f7e65;font-size:24px;margin:0 0 16px">أملاكي</h1>
<h2 style="font-size:20px;margin:0 0 12px">${subjects[kind]}</h2>
<p style="font-size:15px;line-height:1.7;color:#4a5a4d">مرحباً ${recipientName || 'عميلنا الكريم'}،</p>
${kind === 'data-deleted'
  ? `<p style="font-size:15px;line-height:1.7">تم حذف بيانات حسابك بشكل نهائي بعد انتهاء فترة الاحتفاظ (30 يوماً). يمكنك إنشاء حساب جديد في أي وقت.</p>`
  : `<p style="font-size:15px;line-height:1.7">انتهى اشتراكك في أملاكي. بياناتك محفوظة في وضع <strong>القراءة فقط</strong> لمدة <strong style="color:#b8895a">${daysLeft} يوماً</strong> قبل الحذف النهائي.</p>
<p style="font-size:15px;line-height:1.7">يمكنك تصدير بياناتك أو إعادة تفعيل الاشتراك في أي وقت:</p>
<div style="margin:24px 0">
<a href="${exportUrl}" style="display:inline-block;background:#5f7e65;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;margin-left:12px">تصدير بياناتي</a>
<a href="${dashboardUrl}" style="display:inline-block;background:#a89456;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700">إعادة التفعيل</a>
</div>`
}
<hr style="border:none;border-top:1px solid rgba(95,126,101,.12);margin:24px 0">
<p style="font-size:12px;color:#7a8e9a">فريق أملاكي — إدارة عقاراتك بذكاء وأناقة</p>
</div></body></html>`;

    await admin().from('email_send_log').insert({
      recipient_email: email,
      template_name: kind,
      status: 'pending',
      metadata: { kind, daysLeft },
    });

    const { error } = await admin().rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: email,
        subject: subjects[kind],
        html,
        template_name: kind,
      },
    });
    if (error) console.error('enqueue_email error', error);
  } catch (e) {
    console.error('sendReminder error', e);
  }
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
  const stats = { promotedToGrace: 0, reminders7d: 0, reminders1d: 0, deleted: 0 };

  const { data: toGrace } = await a
    .from('subscriptions')
    .select('id, user_id, current_period_end, profiles:profiles!subscriptions_user_id_fkey(email, name)')
    .eq('environment', 'live')
    .eq('status', 'canceled')
    .lt('current_period_end', now.toISOString())
    .is('data_delete_at', null);

  for (const sub of (toGrace ?? []) as any[]) {
    const periodEnd = new Date(sub.current_period_end);
    const dataDeleteAt = new Date(periodEnd.getTime() + GRACE_DAYS * 86400000);
    await a
      .from('subscriptions')
      .update({
        grace_started_at: periodEnd.toISOString(),
        data_delete_at: dataDeleteAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', sub.id);

    const { data: profile } = await a.from('profiles').select('email, name').eq('id', sub.user_id).maybeSingle();
    if (profile?.email) {
      await sendReminder(profile.email, profile.name ?? '', 'grace-started', GRACE_DAYS);
      await a.from('subscriptions').update({
        last_reminder_sent_at: now.toISOString(),
        last_reminder_kind: 'grace-started',
      }).eq('id', sub.id);
    }
    stats.promotedToGrace++;
  }

  const { data: inGrace } = await a
    .from('subscriptions')
    .select('id, user_id, data_delete_at, last_reminder_kind')
    .eq('environment', 'live')
    .not('data_delete_at', 'is', null)
    .gt('data_delete_at', now.toISOString());

  for (const sub of (inGrace ?? []) as any[]) {
    const deleteAt = new Date(sub.data_delete_at);
    const daysLeft = Math.ceil((deleteAt.getTime() - now.getTime()) / 86400000);

    let kind: 'grace-7-days' | 'grace-1-day' | null = null;
    if (daysLeft <= 1 && sub.last_reminder_kind !== 'grace-1-day') kind = 'grace-1-day';
    else if (daysLeft <= 7 && daysLeft > 1 && !['grace-7-days', 'grace-1-day'].includes(sub.last_reminder_kind ?? '')) kind = 'grace-7-days';

    if (kind) {
      const { data: profile } = await a.from('profiles').select('email, name').eq('id', sub.user_id).maybeSingle();
      if (profile?.email) {
        await sendReminder(profile.email, profile.name ?? '', kind, daysLeft);
        await a.from('subscriptions').update({
          last_reminder_sent_at: now.toISOString(),
          last_reminder_kind: kind,
        }).eq('id', sub.id);
        if (kind === 'grace-7-days') stats.reminders7d++;
        else stats.reminders1d++;
      }
    }
  }

  const { data: toDelete } = await a
    .from('subscriptions')
    .select('id, user_id, data_delete_at')
    .eq('environment', 'live')
    .not('data_delete_at', 'is', null)
    .lt('data_delete_at', now.toISOString())
    .neq('status', 'deleted');

  for (const sub of (toDelete ?? []) as any[]) {
    await deleteUserData(sub.user_id);
    await a
      .from('subscriptions')
      .update({ status: 'deleted', updated_at: now.toISOString() })
      .eq('id', sub.id);
    await a.from('profiles').update({
      subscription_status: 'deleted',
      updated_at: now.toISOString(),
    }).eq('id', sub.user_id);

    const { data: profile } = await a.from('profiles').select('email, name').eq('id', sub.user_id).maybeSingle();
    if (profile?.email) await sendReminder(profile.email, profile.name ?? '', 'data-deleted', 0);
    stats.deleted++;
  }

  return stats;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const stats = await run();
    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('subscription-lifecycle error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
