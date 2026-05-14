// Edge function: delete the authenticated user's account and all related data.
// Required for Apple App Store compliance (Guideline 5.1.1(v)).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user from JWT
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Service-role admin client for cascading deletes
    const admin = createClient(SUPABASE_URL, SERVICE);

    // Buildings owned by user (cascade payments/tenancies/units/expenses via building_id)
    const { data: buildings } = await admin
      .from("buildings").select("id").eq("user_id", userId);
    const buildingIds = (buildings ?? []).map((b: any) => b.id);

    if (buildingIds.length) {
      // payments via units in those buildings
      const { data: units } = await admin
        .from("units").select("id").in("building_id", buildingIds);
      const unitIds = (units ?? []).map((u: any) => u.id);
      if (unitIds.length) {
        await admin.from("payments").delete().in("unit_id", unitIds);
      }
      await admin.from("expenses").delete().in("building_id", buildingIds);
      await admin.from("tenancies").delete().in("building_id", buildingIds);
      await admin.from("units").delete().in("building_id", buildingIds);
      await admin.from("invitations").delete().in("building_id", buildingIds);
      await admin.from("building_members").delete().in("building_id", buildingIds);
      await admin.from("buildings").delete().in("id", buildingIds);
    }

    // Memberships in other people's buildings
    await admin.from("building_members").delete().eq("user_id", userId);

    // Profile + roles + subscription events
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("subscription_events").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // Finally delete the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
