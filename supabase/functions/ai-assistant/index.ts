const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
- For analytics: compute from payments_last_6mo and expenses_last_6mo.
- For reminder messages: write polite, short, professional messages, addressing tenant by name when relevant.
- For predictions: base them on trends in the data and clearly state assumptions.
- If data is insufficient, say so briefly and suggest what to add.
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
