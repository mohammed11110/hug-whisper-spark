import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { handoverUrls, returnUrls, lang } = await req.json();
    if (!Array.isArray(handoverUrls) || !Array.isArray(returnUrls) || handoverUrls.length === 0 || returnUrls.length === 0) {
      return new Response(JSON.stringify({ error: 'handoverUrls and returnUrls required (non-empty arrays)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI key missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAr = lang === 'ar';
    const sys = isAr
      ? 'أنت خبير في تقييم حالة العقارات. ستحصل على مجموعتين من الصور: الأولى وقت تسليم الوحدة للمستأجر، والثانية وقت استلامها منه. قارن بدقة وحدّد كل ضرر جديد أو تغيير ملحوظ (خدوش، كسر، بقع، أثاث ناقص، طلاء متضرر...). تجاهل اختلافات الإضاءة والزاوية والأشياء الشخصية المعقولة.'
      : 'You are an expert property condition assessor. You will receive two image groups: handover photos (when given to tenant) and return photos (when taken back). Carefully compare and list every new damage or notable change (scratches, breakage, stains, missing furniture, damaged paint...). Ignore lighting/angle differences and reasonable personal items.';

    const userParts: any[] = [
      { type: 'text', text: isAr ? `صور التسليم (${handoverUrls.length}):` : `Handover photos (${handoverUrls.length}):` },
      ...handoverUrls.slice(0, 8).map((url: string) => ({ type: 'image_url', image_url: { url } })),
      { type: 'text', text: isAr ? `صور الاستلام (${returnUrls.length}):` : `Return photos (${returnUrls.length}):` },
      ...returnUrls.slice(0, 8).map((url: string) => ({ type: 'image_url', image_url: { url } })),
    ];

    const body = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userParts },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'report_damage',
          description: 'Return structured damage report',
          parameters: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: isAr ? 'ملخص قصير بالعربية (سطر أو سطران)' : 'Short summary (1-2 lines)' },
              overall_severity: { type: 'string', enum: ['none', 'minor', 'moderate', 'severe'] },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', description: isAr ? 'الموقع/الغرفة' : 'Location/room' },
                    description: { type: 'string', description: isAr ? 'وصف الضرر بالعربية' : 'Damage description' },
                    severity: { type: 'string', enum: ['minor', 'moderate', 'severe'] },
                  },
                  required: ['location', 'description', 'severity'],
                  additionalProperties: false,
                },
              },
            },
            required: ['summary', 'overall_severity', 'items'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'report_damage' } },
    };

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: isAr ? 'تجاوز الحد، حاول لاحقاً' : 'Rate limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: isAr ? 'الرصيد منتهي' : 'Credits exhausted' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI error', resp.status, t);
      return new Response(JSON.stringify({ error: 'AI error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await resp.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { summary: '', overall_severity: 'none', items: [] };

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('detect-damage error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
