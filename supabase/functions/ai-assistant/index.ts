import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { messages, context, lang } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ar = lang === "ar";
    const systemPrompt = `You are an expert property management assistant for "Amlaki" (أملاكي), a SaaS used by landlords.
Reply in ${ar ? "Arabic (formal, friendly)" : "the user's language"}. Be concise, structured (use markdown bullets/headings when helpful), and actionable.

You have read-only access to this owner's live data:
${JSON.stringify(context ?? {}, null, 2)}

Guidelines:
- Use the data above to give specific numerical answers (totals, counts, names).
- CRITICAL — distinguish two concepts:
  * "تاريخ السداد" (payment_date / payment_month) = when money was received.
  * "شهر الإيجار المُغطّى" (period_start / rent_month) = which rental month the payment covers.
  These can differ. A payment received in May may cover April or June rent.
- For "إيرادات شهر X" / "كم محصّل لشهر X": ALWAYS use collections_by_rent_month[YYYY-MM] (grouped by the rent period the payment covers). Mention collections_by_payment_month only if the user explicitly asks about payments received during a calendar month.
- If any payments appear in unassigned_period_payments, list them and ask the owner to assign a rent month — do NOT silently attribute them to any month.
- A unit is "محصّلة بالكامل" only if its unit_status === "paid". If a payment exists but unit_status is "soon"/"late", treat it as partial or as prior arrears, and say so explicitly (mention unit_number and tenant_name).
- is_partial=true on a payment means the paid amount is less than expected_amount — flag it.
- For reminder messages: polite, short, professional, address tenant by name when relevant.
- For predictions: base on trends, state assumptions clearly.
- If data is insufficient, say so and suggest what to add.
- Never invent data not present in the context.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: ar ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit exceeded, try later" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: ar ? "نفذ الرصيد، أضف رصيداً للحساب" : "Credits exhausted, add funds" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
