import { useEffect, useRef, useState } from "react";
import { ArrowRight, Send, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string }

export default function Assistant() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const suggestions = ar
    ? ["كم محصل هذا الشهر؟", "أي مبنى الأكثر ربحاً؟", "اقترح رسالة تذكير لطيفة", "ما هي توقعات الشهر القادم؟"]
    : ["How much collected this month?", "Which building is most profitable?", "Suggest a gentle reminder message", "Forecast for next month?"];

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading || !user) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      // Gather context
      const { data: bs } = await supabase.from("buildings").select("id, name").eq("user_id", user.id);
      const bIds = (bs || []).map((b: any) => b.id);
      const { data: us } = bIds.length
        ? await supabase.from("units").select("id, building_id, unit_number, status, rent_amount, tenant_name, contract_end_date").in("building_id", bIds)
        : { data: [] as any[] };
      const unitIds = (us || []).map((u: any) => u.id);
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);
      const { data: ps } = unitIds.length
        ? await supabase.from("payments")
            .select("amount, payment_date, unit_id, period_start, period_end, expected_amount, receipt_number, payment_method")
            .in("unit_id", unitIds).gte("payment_date", start).is("deleted_at", null)
        : { data: [] as any[] };
      const { data: ex } = bIds.length
        ? await supabase.from("expenses").select("amount, expense_date, category, building_id").in("building_id", bIds).gte("expense_date", start)
        : { data: [] as any[] };

      const unitMap = new Map((us || []).map((u: any) => [u.id, u]));
      const collections_by_rent_month: Record<string, number> = {};
      const collections_by_payment_month: Record<string, number> = {};
      const unassigned_period: any[] = [];
      const payments_enriched = (ps || []).map((p: any) => {
        const u = unitMap.get(p.unit_id);
        const payMonth = (p.payment_date || "").slice(0, 7);
        const rentMonth = p.period_start ? p.period_start.slice(0, 7) : null;
        const amt = Number(p.amount) || 0;
        if (payMonth) collections_by_payment_month[payMonth] = (collections_by_payment_month[payMonth] || 0) + amt;
        if (rentMonth) collections_by_rent_month[rentMonth] = (collections_by_rent_month[rentMonth] || 0) + amt;
        else unassigned_period.push({ unit_id: p.unit_id, amount: amt, payment_date: p.payment_date });
        return {
          ...p,
          rent_month: rentMonth,
          payment_month: payMonth,
          unit_status: u?.status || null,
          unit_number: u?.unit_number || null,
          tenant_name: u?.tenant_name || null,
          is_partial: p.expected_amount != null && Number(p.amount) < Number(p.expected_amount),
        };
      });

      const cm = today.toISOString().slice(0, 7);
      const context = {
        current_month_key: cm,
        today: today.toISOString().slice(0, 10),
        buildings: bs || [],
        units_summary: {
          total: us?.length || 0,
          paid: us?.filter((u: any) => u.status === "paid").length || 0,
          soon: us?.filter((u: any) => u.status === "soon").length || 0,
          late: us?.filter((u: any) => u.status === "late").length || 0,
          vacant: us?.filter((u: any) => u.status === "vacant").length || 0,
        },
        collections_by_rent_month,
        collections_by_payment_month,
        unassigned_period_payments: unassigned_period,
        payments_last_6mo: payments_enriched,
        expenses_last_6mo: ex || [],
        units: us || [],
      };

      const resp = await supabase.functions.invoke("ai-assistant", {
        body: { messages: next, context, lang },
      });

      if (resp.error) throw resp.error;
      const reply = (resp.data as any)?.reply || "";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      const msg = e?.message || (ar ? "حدث خطأ" : "An error occurred");
      toast.error(msg);
      setMessages([...next, { role: "assistant", content: ar ? "عذراً، حصل خطأ. حاول مرة أخرى." : "Sorry, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell pb-24 bg-background flex flex-col h-screen">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2 flex-shrink-0">
        <Link to="/" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-sage grid place-items-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-black text-sage-600">{ar ? "المساعد الذكي" : "AI Assistant"}</h1>
            <p className="text-[10px] text-muted-foreground">{ar ? "مدعوم بـ Lovable AI" : "Powered by Lovable AI"}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 mt-4 space-y-3 pb-32">
        {messages.length === 0 && (
          <div className="space-y-4 mt-6">
            <div className="text-center">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-sage items-center justify-center mb-2">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="font-black text-sage-600">{ar ? "كيف يمكنني مساعدتك؟" : "How can I help?"}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {ar ? "اسألني عن عقاراتك، التحصيل، التقارير، أو اطلب صياغة رسالة" : "Ask about your properties, payments, reports, or request message drafts"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-start text-sm bg-card border border-sage-200/60 rounded-xl px-3 py-2.5 hover:bg-sage-100/50 text-sage-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-gradient-sage text-primary-foreground rounded-br-md"
                  : "bg-card border border-sage-200/60 text-sage-600 rounded-bl-md"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-headings:text-sage-600 prose-strong:text-sage-600">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-sage-200/60 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {ar ? "يفكر..." : "Thinking..."}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-16 inset-x-0 mx-auto max-w-[430px] px-3 pb-2 bg-gradient-to-t from-background via-background/95 to-transparent pt-3 z-30">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex gap-2 bg-card rounded-2xl border border-sage-200/60 p-1.5 shadow-soft"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ar ? "اكتب سؤالك..." : "Ask anything..."}
            disabled={loading}
            className="border-0 focus-visible:ring-0 bg-transparent"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            size="icon"
            className="rounded-xl bg-gradient-sage text-primary-foreground flex-shrink-0"
          >
            <Send className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </form>
      </div>

      <BottomNav />
    </div>
  );
}
