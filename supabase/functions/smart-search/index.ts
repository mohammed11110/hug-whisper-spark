import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { q, lang } = await req.json();
    const query = String(q || "").trim();
    if (!query) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ar = lang === "ar";

    // Load owner's data (RLS lets owner + members read)
    const { data: bs } = await supabase.from("buildings").select("id, name, name_en, city");
    const bIds = (bs || []).map((b: any) => b.id);
    const { data: us } = bIds.length
      ? await supabase.from("units")
          .select("id, building_id, unit_number, type, status, rent_amount, rent_type, tenant_name, tenant_phone, contract_start_date, contract_end_date, last_paid_date")
          .in("building_id", bIds)
      : { data: [] as any[] };
    const unitIds = (us || []).map((u: any) => u.id);
    const sinceStr = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: ps } = unitIds.length
      ? await supabase.from("payments")
          .select("id, unit_id, amount, payment_date, period_start, receipt_number")
          .in("unit_id", unitIds).gte("payment_date", sinceStr).is("deleted_at", null)
      : { data: [] as any[] };

    const bMap = new Map((bs || []).map((b: any) => [b.id, b.name || b.name_en || "—"]));
    const unitsCompact = (us || []).map((u: any) => ({
      id: u.id,
      building: bMap.get(u.building_id) || "",
      building_id: u.building_id,
      unit_number: u.unit_number,
      type: u.type,
      status: u.status,
      rent_amount: Number(u.rent_amount),
      rent_type: u.rent_type,
      tenant_name: u.tenant_name,
      tenant_phone: u.tenant_phone,
      contract_start_date: u.contract_start_date,
      contract_end_date: u.contract_end_date,
      last_paid_date: u.last_paid_date,
    }));
    const paymentsByUnit: Record<string, { count: number; total: number; last_date: string | null }> = {};
    (ps || []).forEach((p: any) => {
      const cur = paymentsByUnit[p.unit_id] || { count: 0, total: 0, last_date: null };
      cur.count += 1;
      cur.total += Number(p.amount) || 0;
      if (!cur.last_date || p.payment_date > cur.last_date) cur.last_date = p.payment_date;
      paymentsByUnit[p.unit_id] = cur;
    });

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `You match a natural-language query against a property-management dataset. Return up to 12 best-matching items.
Today: ${today}. User language: ${ar ? "Arabic" : "English"}. Respond reasons in that language.

Item types:
- "building" → id is buildings.id
- "unit" → id is units.id (use this for units, tenants, or anything related to a specific unit)

Status meanings: paid=محصّل, soon=قريب الاستحقاق, late=متأخر, vacant=شاغر.
"متأخر/late" → status === "late". "شاغر/vacant" → status === "vacant". "محصّل/paid" → status === "paid".
Match building name fuzzily. Match tenant names, phone, unit numbers, status, rent ranges.

DATA:
Buildings: ${JSON.stringify(bs || [])}
Units (with summary): ${JSON.stringify(unitsCompact)}
Payment summary by unit (last 12mo): ${JSON.stringify(paymentsByUnit)}

Return concise reason (max ~10 words) per item explaining WHY it matched. If nothing matches, return empty array.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_matches",
            description: "Return matched items",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["building", "unit"] },
                      id: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["type", "id", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_matches" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: ar ? "تم تجاوز الحد، حاول لاحقاً" : "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: ar ? "نفذ الرصيد" : "Credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : { results: [] };
    const matches: { type: string; id: string; reason: string }[] = args.results || [];

    // Enrich with title/subtitle/route
    const unitMap = new Map(unitsCompact.map((u) => [u.id, u]));
    const enriched = matches.map((m) => {
      if (m.type === "building") {
        const b = (bs || []).find((x: any) => x.id === m.id);
        if (!b) return null;
        return {
          type: "building" as const,
          id: m.id,
          title: b.name || b.name_en || "—",
          subtitle: m.reason,
          to: `/buildings/${m.id}`,
        };
      }
      const u = unitMap.get(m.id);
      if (!u) return null;
      return {
        type: u.tenant_name ? ("tenant" as const) : ("unit" as const),
        id: m.id,
        title: u.tenant_name ? u.tenant_name : `${u.building} · ${u.unit_number}`,
        subtitle: `${u.building} · ${u.unit_number} — ${m.reason}`,
        to: `/units/${m.id}`,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify({ results: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-search error:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
