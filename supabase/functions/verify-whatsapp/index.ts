import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_ATTEMPTS = 5;
const CODE_TTL_MIN = 10;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function normalizePhone(p: string): string {
  // keep leading +, strip everything else
  const cleaned = (p || '').replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) return '';
  return cleaned;
}

function isValidE164(p: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(p);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === 'request_code') {
      const phone = normalizePhone(String(body?.phone || ''));
      if (!isValidE164(phone)) {
        return new Response(JSON.stringify({ error: 'رقم غير صالح. استخدم الصيغة الدولية مثل +9665XXXXXXXX' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const rand = new Uint32Array(1);
      crypto.getRandomValues(rand);
      const code = String(100000 + (rand[0] % 900000));
      const expires = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();

      const { error } = await admin
        .from('profiles')
        .update({
          business_whatsapp: phone,
          whatsapp_verification_code: code,
          whatsapp_code_expires_at: expires,
          whatsapp_verification_attempts: 0,
          whatsapp_verified_at: null,
        })
        .eq('id', userId);

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, phone, expiresAt: expires }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify_code') {
      const input = String(body?.code || '').trim();
      if (!/^\d{6}$/.test(input)) {
        return new Response(JSON.stringify({ error: 'الكود يجب أن يكون 6 أرقام' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile, error: pErr } = await admin
        .from('profiles')
        .select('whatsapp_verification_code, whatsapp_code_expires_at, whatsapp_verification_attempts, business_whatsapp')
        .eq('id', userId)
        .maybeSingle();

      if (pErr) throw pErr;
      if (!profile?.whatsapp_verification_code || !profile?.whatsapp_code_expires_at) {
        return new Response(JSON.stringify({ error: 'لا يوجد كود نشط، اطلب كوداً جديداً' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (new Date(profile.whatsapp_code_expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: 'انتهت صلاحية الكود، اطلب كوداً جديداً' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if ((profile.whatsapp_verification_attempts ?? 0) >= MAX_ATTEMPTS) {
        return new Response(JSON.stringify({ error: 'تجاوزت الحد، اطلب كوداً جديداً' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!timingSafeEqual(input, profile.whatsapp_verification_code)) {
        await admin
          .from('profiles')
          .update({ whatsapp_verification_attempts: (profile.whatsapp_verification_attempts ?? 0) + 1 })
          .eq('id', userId);
        return new Response(JSON.stringify({ error: 'كود غير صحيح' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await admin
        .from('profiles')
        .update({
          whatsapp_verified_at: new Date().toISOString(),
          whatsapp_verification_code: null,
          whatsapp_code_expires_at: null,
          whatsapp_verification_attempts: 0,
        })
        .eq('id', userId);

      return new Response(JSON.stringify({ ok: true, verified: true, phone: profile.business_whatsapp }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset') {
      await admin
        .from('profiles')
        .update({
          business_whatsapp: null,
          whatsapp_verified_at: null,
          whatsapp_verification_code: null,
          whatsapp_code_expires_at: null,
          whatsapp_verification_attempts: 0,
        })
        .eq('id', userId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('verify-whatsapp error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
