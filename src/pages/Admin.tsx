import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, Crown, Clock, Building2, Search, Download, Ticket } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/useAdmin";
import { supabase } from "@/integrations/supabase/client";

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  created_at: string;
  buildings_count: number;
  units_count: number;
  tenants_count: number;
}

interface PromoRow {
  id: string;
  code: string;
  plan: string;
  duration_days: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
}

type Filter = "all" | "pro" | "free" | "expired";

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<"users" | "promos">("users");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: u }, { data: p }] = await Promise.all([
        supabase.from("admin_users_overview" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
      ]);
      setUsers((u as any) || []);
      setPromos((p as any) || []);
      setLoading(false);
    })();
  }, [isAdmin]);

  const stats = useMemo(() => {
    const now = Date.now();
    const pro = users.filter(u => u.subscription_plan === "pro" && u.subscription_status === "active" && (!u.subscription_expires_at || new Date(u.subscription_expires_at).getTime() > now)).length;
    const expired = users.filter(u => u.subscription_expires_at && new Date(u.subscription_expires_at).getTime() <= now).length;
    return {
      total: users.length,
      pro,
      free: users.length - pro - expired,
      expired,
      promosUsed: promos.reduce((s, p) => s + p.used_count, 0),
      promosLeft: promos.reduce((s, p) => s + (p.max_uses - p.used_count), 0),
    };
  }, [users, promos]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return users.filter(u => {
      if (q && !(`${u.name || ""} ${u.email || ""} ${u.phone || ""}`.toLowerCase().includes(q))) return false;
      const isPro = u.subscription_plan === "pro" && u.subscription_status === "active" && (!u.subscription_expires_at || new Date(u.subscription_expires_at).getTime() > now);
      const isExpired = u.subscription_expires_at && new Date(u.subscription_expires_at).getTime() <= now;
      if (filter === "pro") return isPro;
      if (filter === "expired") return isExpired;
      if (filter === "free") return !isPro && !isExpired;
      return true;
    });
  }, [users, search, filter]);

  const exportCSV = () => {
    const headers = ["الاسم", "الإيميل", "الجوال", "تاريخ التسجيل", "الخطة", "الحالة", "ينتهي في", "المباني", "الوحدات", "المستأجرون"];
    const rows = filteredUsers.map(u => [
      u.name || "", u.email || "", u.phone || "",
      u.created_at?.slice(0, 10) || "",
      u.subscription_plan, u.subscription_status,
      u.subscription_expires_at?.slice(0, 10) || "",
      u.buildings_count, u.units_count, u.tenants_count,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (adminLoading) return <div className="p-8 text-center text-sage-500">جارٍ التحميل…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-sage-600 tracking-tight">لوحة المسؤول</h1>
          <Crown className="h-5 w-5 text-accent" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">إدارة المستخدمين والاشتراكات والأكواد</p>
      </div>

      {/* Stats */}
      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="مسجّلون" value={stats.total} tone="sage" />
        <StatCard icon={<Crown className="h-4 w-4" />} label="مشتركون Pro" value={stats.pro} tone="gold" />
        <StatCard icon={<Clock className="h-4 w-4" />} label="منتهي" value={stats.expired} tone="burgundy" />
        <StatCard icon={<Ticket className="h-4 w-4" />} label="أكواد مُستخدمة" value={`${stats.promosUsed}/${stats.promosUsed + stats.promosLeft}`} tone="terracotta" />
      </div>

      {/* Tabs */}
      <div className="px-5 mt-5">
        <div className="flex gap-2 bg-sage-100/60 rounded-xl p-1">
          <button onClick={() => setTab("users")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === "users" ? "bg-card text-sage-600 shadow-soft" : "text-muted-foreground"}`}>المستخدمون ({stats.total})</button>
          <button onClick={() => setTab("promos")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === "promos" ? "bg-card text-sage-600 shadow-soft" : "text-muted-foreground"}`}>أكواد الترويج ({promos.length})</button>
        </div>
      </div>

      {tab === "users" && (
        <>
          <div className="px-5 mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-sage-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الإيميل أو الجوال..."
                className="ps-10 rounded-xl border-sage-200 bg-card h-11" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {([["all", "الكل"], ["pro", "Pro نشط"], ["free", "مجاني"], ["expired", "منتهي"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${filter === k ? "bg-sage-500 text-primary-foreground" : "bg-sage-100 text-sage-600"}`}>{l}</button>
              ))}
              <Button onClick={exportCSV} variant="outline" size="sm" className="ms-auto h-8 rounded-full text-xs">
                <Download className="h-3 w-3 me-1" /> CSV
              </Button>
            </div>
          </div>

          <div className="px-5 mt-3 space-y-2">
            {loading ? <p className="text-center text-sage-500 py-12 text-sm">جارٍ التحميل…</p>
              : filteredUsers.length === 0 ? <p className="text-center text-muted-foreground py-12 text-sm">لا يوجد مستخدمون</p>
              : filteredUsers.map(u => <UserCard key={u.id} u={u} />)}
          </div>
        </>
      )}

      {tab === "promos" && (
        <div className="px-5 mt-4 space-y-2">
          {promos.map(p => (
            <div key={p.id} className="bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono font-black text-lg text-sage-600">{p.code}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {p.plan.toUpperCase()} · {p.duration_days} يوم
                    {p.expires_at && ` · ينتهي ${p.expires_at.slice(0, 10)}`}
                  </p>
                  {p.redeemed_at && (
                    <p className="text-[11px] text-sage-500 mt-1">
                      مُستخدم في {p.redeemed_at.slice(0, 10)}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  p.used_count >= p.max_uses ? "bg-muted text-muted-foreground" : "bg-sage-300/30 text-sage-600"
                }`}>
                  {p.used_count >= p.max_uses ? "مُستخدم" : "متاح"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: string }) {
  const tones: Record<string, string> = {
    sage: "bg-sage-400/10 text-sage-500",
    gold: "bg-accent/10 text-accent",
    burgundy: "bg-burgundy/10 text-burgundy",
    terracotta: "bg-terracotta/10 text-terracotta",
  };
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft border border-sage-200/40">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-2xl font-black text-sage-600 mt-0.5">{value}</p>
    </div>
  );
}

function UserCard({ u }: { u: UserRow }) {
  const now = Date.now();
  const isPro = u.subscription_plan === "pro" && u.subscription_status === "active" && (!u.subscription_expires_at || new Date(u.subscription_expires_at).getTime() > now);
  const isExpired = u.subscription_expires_at && new Date(u.subscription_expires_at).getTime() <= now;
  const badge = isPro ? { c: "bg-accent/15 text-accent", t: "PRO" } : isExpired ? { c: "bg-burgundy/15 text-burgundy", t: "منتهي" } : { c: "bg-sage-300/30 text-sage-600", t: "مجاني" };

  return (
    <div className="bg-card border border-sage-200/40 rounded-2xl p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-sage text-primary-foreground flex items-center justify-center font-black flex-shrink-0">
          {(u.name || u.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sage-600 truncate">{u.name || "—"}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.c}`}>{badge.t}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          {u.phone && <p className="text-[11px] text-muted-foreground">{u.phone}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-[11px] text-sage-500">
            <span>سُجِّل: {u.created_at?.slice(0, 10)}</span>
            {u.subscription_expires_at && <span>ينتهي: {u.subscription_expires_at.slice(0, 10)}</span>}
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{u.buildings_count} مباني</span>
            <span>{u.units_count} وحدة</span>
            <span>{u.tenants_count} مستأجر</span>
          </div>
        </div>
      </div>
    </div>
  );
}
