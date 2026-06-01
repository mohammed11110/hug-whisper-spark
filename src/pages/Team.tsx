import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, UserPlus, Trash2, Shield, Mail, Crown } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "manager" | "accountant" | "viewer";
interface Building { id: string; name: string }
interface Member { id: string; building_id: string; user_id: string; role: Role }
interface Invitation { id: string; building_id: string; email: string; role: Role; status: string; token: string }

const ROLE_LABEL: Record<Role, { ar: string; en: string }> = {
  manager: { ar: "مدير", en: "Manager" },
  accountant: { ar: "محاسب", en: "Accountant" },
  viewer: { ar: "عارض", en: "Viewer" },
};

export default function Team() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const ar = lang === "ar";
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { name?: string; email?: string }>>({});
  const [building, setBuilding] = useState<string>("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [allowance, setAllowance] = useState<number>(0);
  const [usage, setUsage] = useState<number>(0);

  const load = async () => {
    if (!user) return;
    const { data: bs } = await supabase.from("buildings").select("id, name").eq("user_id", user.id);
    setBuildings(bs || []);
    if (!building && bs && bs[0]) setBuilding(bs[0].id);
    const ids = (bs || []).map((b) => b.id);
    if (ids.length) {
      const [{ data: ms }, { data: ivs }] = await Promise.all([
        supabase.from("building_members").select("*").in("building_id", ids),
        supabase.from("invitations").select("*").in("building_id", ids).eq("status", "pending"),
      ]);
      setMembers((ms as Member[]) || []);
      setInvites((ivs as Invitation[]) || []);
      const userIds = Array.from(new Set((ms || []).map((m: any) => m.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
        const map: Record<string, any> = {};
        (profs || []).forEach((p: any) => { map[p.id] = { name: p.name, email: p.email }; });
        setMemberProfiles(map);
      }
    }
    const [{ data: allow }, { data: cnt }] = await Promise.all([
      (supabase.rpc as any)("user_member_allowance", { _user_id: user.id }),
      (supabase.rpc as any)("user_member_count", { _user_id: user.id }),
    ]);
    setAllowance(Number(allow ?? 0));
    setUsage(Number(cnt ?? 0));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const isUnlimited = allowance >= 2147483647;
  const atLimit = !isUnlimited && usage >= allowance;
  const allowanceLabel = isUnlimited ? "∞" : String(allowance);

  const invite = async () => {
    if (!email.trim() || !building || !user) return;
    if (atLimit) {
      toast.error(ar ? "وصلت لحد الباقة. رقّ الباقة لإضافة المزيد." : "Plan limit reached. Upgrade to add more.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("invitations").insert({
      building_id: building,
      email: email.trim().toLowerCase(),
      role,
      invited_by: user.id,
    });
    setBusy(false);
    if (error) {
      if (error.message?.includes("member_quota_exceeded")) {
        return toast.error(ar ? "وصلت لحد الباقة. رقّ الباقة لإضافة المزيد." : "Plan limit reached. Upgrade to add more.");
      }
      return toast.error(error.message);
    }
    toast.success(ar ? "تم إرسال الدعوة" : "Invitation sent");
    setEmail("");
    load();
  };

  const removeInvite = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeMember = async (id: string) => {
    if (!confirm(ar ? "إزالة هذا العضو؟" : "Remove this member?")) return;
    const { error } = await supabase.from("building_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const updateRole = async (id: string, r: Role) => {
    const { error } = await supabase.from("building_members").update({ role: r }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const buildingName = (id: string) => buildings.find((b) => b.id === id)?.name || "—";

  return (
    <div className="mobile-shell pb-24">
      <TopBar />
      <div className="px-5 pt-2 flex items-center gap-2">
        <Link to="/settings" className="text-sage-500"><ArrowRight className="h-5 w-5 rtl:rotate-180" /></Link>
        <h1 className="text-2xl font-black text-sage-600">{ar ? "الفريق والصلاحيات" : "Team & Roles"}</h1>
      </div>

      {buildings.length === 0 ? (
        <div className="px-5 pt-10 text-center text-muted-foreground text-sm">
          {ar ? "أضف مبنى أولاً لإدارة الفريق." : "Add a building first to manage your team."}
        </div>
      ) : (
        <div className="px-5 pt-5 space-y-5">
          {/* Invite form */}
          <div className="bg-card border border-sage-200/60 rounded-2xl p-4 shadow-soft space-y-3">
            <div className="flex items-center gap-2 text-sage-600">
              <UserPlus className="h-4 w-4" />
              <p className="font-bold text-sm">{ar ? "دعوة عضو جديد" : "Invite a new member"}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-sage-600 font-semibold">{ar ? "المبنى" : "Building"}</Label>
              <select value={building} onChange={(e) => setBuilding(e.target.value)}
                className="w-full h-10 rounded-xl border border-sage-200 bg-card px-3 text-sm">
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-sage-600 font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com" className="rounded-xl border-sage-200 bg-card" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-sage-600 font-semibold">{ar ? "الدور" : "Role"}</Label>
              <div className="flex gap-1.5">
                {(["manager", "accountant", "viewer"] as Role[]).map((r) => (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${
                      role === r ? "bg-gradient-sage text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                    }`}>{ROLE_LABEL[r][ar ? "ar" : "en"]}</button>
                ))}
              </div>
            </div>
            <Button onClick={invite} disabled={busy || !email.trim()}
              className="w-full rounded-xl bg-gradient-sage text-primary-foreground font-semibold">
              {ar ? "إرسال الدعوة" : "Send invitation"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "سيُضاف العضو تلقائياً عند تسجيل دخوله بهذا البريد."
                : "Member is added automatically when they sign in with this email."}
            </p>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-sage-600 mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" /> {ar ? "دعوات معلّقة" : "Pending invitations"}
              </h2>
              <div className="space-y-2">
                {invites.map((iv) => (
                  <div key={iv.id} className="bg-card border border-sage-200/60 rounded-2xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-sage-600 truncate">{iv.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {buildingName(iv.building_id)} · {ROLE_LABEL[iv.role][ar ? "ar" : "en"]}
                      </p>
                    </div>
                    <button onClick={() => removeInvite(iv.id)} className="p-2 rounded-lg text-burgundy hover:bg-burgundy/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active members */}
          <div>
            <h2 className="text-sm font-bold text-sage-600 mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" /> {ar ? "الأعضاء النشطون" : "Active members"}
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا يوجد أعضاء بعد." : "No members yet."}</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => {
                  const p = memberProfiles[m.user_id];
                  return (
                    <div key={m.id} className="bg-card border border-sage-200/60 rounded-2xl p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center font-black">
                          {(p?.name || p?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-sage-600 truncate">{p?.name || p?.email || m.user_id.slice(0, 8)}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{buildingName(m.building_id)}</p>
                        </div>
                        <button onClick={() => removeMember(m.id)} className="p-2 rounded-lg text-burgundy hover:bg-burgundy/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        {(["manager", "accountant", "viewer"] as Role[]).map((r) => (
                          <button key={r} onClick={() => updateRole(m.id, r)}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold ${
                              m.role === r ? "bg-gradient-sage text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>{ROLE_LABEL[r][ar ? "ar" : "en"]}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Role explainer */}
          <div className="bg-sage-50 border border-sage-200/60 rounded-2xl p-4 text-xs space-y-1.5 text-sage-600">
            <p className="flex gap-2"><Crown className="h-3.5 w-3.5 mt-0.5" /><span><b>{ROLE_LABEL.manager[ar ? "ar" : "en"]}:</b> {ar ? "تعديل الوحدات والدفعات والمصروفات" : "Edit units, payments, expenses"}</span></p>
            <p className="flex gap-2"><Crown className="h-3.5 w-3.5 mt-0.5" /><span><b>{ROLE_LABEL.accountant[ar ? "ar" : "en"]}:</b> {ar ? "تسجيل دفعات ومصروفات فقط" : "Record payments & expenses only"}</span></p>
            <p className="flex gap-2"><Crown className="h-3.5 w-3.5 mt-0.5" /><span><b>{ROLE_LABEL.viewer[ar ? "ar" : "en"]}:</b> {ar ? "عرض فقط" : "Read-only access"}</span></p>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
